import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAgent } from "@/server/agent-chat";
import { speakText, transcribeAudio } from "@/server/agent-voice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Send, Bot, ArrowLeft, Calendar, Clock, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/agents/$agentId")({
  head: () => ({ meta: [{ title: "Agent — Agent Factory" }] }),
  component: AgentDetailPage,
});

interface Agent {
  id: string;
  business_name: string;
  assistant_name: string | null;
  industry: string | null;
  tone: string | null;
  primary_goal: string | null;
  services: string | null;
  booking_link: string | null;
  emergency_number: string | null;
  faqs: string | null;
  pricing_notes: string | null;
  escalation_triggers: string | null;
  is_live: boolean;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  ts: Date;
}

function AgentDetailPage() {
  const { agentId } = useParams({ from: "/dashboard/agents/$agentId" });
  const { user } = useAuth();
  const chat = useServerFn(chatWithAgent);
  const speak = useServerFn(speakText);
  const transcribe = useServerFn(transcribeAudio);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const assistantName = agent?.assistant_name?.trim() || "Ava";

  // Load agent + greeting
  useEffect(() => {
    if (!user) return;
    supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const a = data as Agent;
          setAgent(a);
          const name = a.assistant_name?.trim() || "Ava";
          const greeting = `Hi there! This is ${name} with ${a.business_name}. How can I help you today?`;
          setMessages([{ role: "assistant", content: greeting, ts: new Date() }]);
          // Speak the greeting
          if (voiceOn) playReply(greeting);
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, user]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Cleanup any active stream on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      audioElRef.current?.pause();
    };
  }, []);

  const playReply = async (text: string) => {
    try {
      setSpeaking(true);
      const res = await speak({ data: { text } });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const audio = new Audio(`data:audio/mpeg;base64,${res.audioBase64}`);
      audioElRef.current = audio;
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch (e) {
      console.error(e);
      setSpeaking(false);
    }
  };

  const sendText = async (text: string) => {
    if (!text.trim() || !agent || sending) return;
    const userMsg: Msg = { role: "user", content: text.trim(), ts: new Date() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await chat({
        data: {
          agent: { ...agent, assistant_name: assistantName },
          messages: history,
        },
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: res.reply, ts: new Date() }]);
      if (voiceOn) playReply(res.reply);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      // Stop any current playback so the agent isn't talking over you
      audioElRef.current?.pause();
      setSpeaking(false);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (blob.size < 1000) {
          toast("Didn't catch that — try again");
          return;
        }
        await handleVoiceInput(blob, mime);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      console.error(e);
      toast.error("Microphone access denied. Please allow mic access in your browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleVoiceInput = async (blob: Blob, mime: string) => {
    setTranscribing(true);
    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await transcribe({ data: { audioBase64, mimeType: mime } });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      if (!res.text) {
        toast("Didn't catch that — try again");
        return;
      }
      await sendText(res.text);
    } finally {
      setTranscribing(false);
    }
  };

  const suggestions = [
    "What are your hours?",
    "How do I book?",
    "What services do you offer?",
    "Do you handle emergencies?",
    "Where are you located?",
  ];

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  }
  if (!agent) {
    return (
      <div className="p-12 text-center">
        <p className="text-muted-foreground mb-4">Agent not found.</p>
        <Link to="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const micBusy = transcribing || sending;
  const micState = recording ? "recording" : speaking ? "speaking" : micBusy ? "thinking" : "idle";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 flex items-start justify-between">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <h1 className="font-display text-3xl font-bold text-foreground">{agent.business_name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{assistantName} · AI Receptionist</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (voiceOn) {
                audioElRef.current?.pause();
                setSpeaking(false);
              }
              setVoiceOn((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label={voiceOn ? "Mute voice" : "Unmute voice"}
          >
            {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {voiceOn ? "Voice on" : "Voice off"}
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-emerald-700">Live</span>
          </div>
        </div>
      </div>

      {/* Chat surface */}
      <div className="flex-1 px-8 pb-4">
        <div ref={scrollRef} className="h-[42vh] overflow-y-auto space-y-4 py-4">
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} />
          ))}
          {(sending || transcribing) && (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[oklch(0.95_0.05_75)] flex items-center justify-center">
                <Bot className="h-5 w-5 text-[var(--gold)]" />
              </div>
              <div className="bg-card border border-border rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                {transcribing ? "Listening…" : "Thinking…"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Suggestions */}
      <div className="px-8 pb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Try Asking
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => sendText(s)}
              disabled={sending || transcribing}
              className="px-4 py-2 rounded-full border border-border bg-card text-sm text-foreground hover:bg-muted transition disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Voice / input panel */}
      <div className="border-t border-border bg-card">
        <div className="px-8 py-6">
          <Visualizer state={micState} />

          {/* Mic */}
          <div className="flex flex-col items-center mb-4">
            <button
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={() => recording && stopRecording()}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={micBusy && !recording}
              className={`h-20 w-20 rounded-full flex items-center justify-center transition shadow-lg ${
                recording
                  ? "bg-red-500 border-2 border-red-600 scale-105"
                  : "bg-card border-2 border-border hover:border-[var(--gold)]"
              } disabled:opacity-50`}
              aria-label={recording ? "Release to send" : "Hold to speak"}
            >
              {recording ? (
                <MicOff className="h-8 w-8 text-white" />
              ) : (
                <Mic className="h-8 w-8 text-foreground" />
              )}
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-2">
              {recording
                ? "Release to Send"
                : transcribing
                  ? "Transcribing…"
                  : speaking
                    ? `${assistantName} is speaking…`
                    : "Hold to Speak"}
            </span>
          </div>

          {/* Type input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendText(input);
            }}
            className="flex gap-2 max-w-2xl mx-auto"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Or type your message…"
              disabled={sending || transcribing}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={sending || transcribing || !input.trim()}
              className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>

          {/* Footer chips */}
          <div className="flex justify-center gap-6 mt-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Available 24/7
            </span>
            {agent.booking_link && (
              <a
                href={agent.booking_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-[var(--gold)]"
              >
                <Calendar className="h-3.5 w-3.5" /> Book Online
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Visualizer({ state }: { state: "recording" | "speaking" | "thinking" | "idle" }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (state === "idle") return;
    const id = setInterval(() => setTick((t) => t + 1), 80);
    return () => clearInterval(id);
  }, [state]);

  const active = state !== "idle";
  return (
    <div className="flex justify-center gap-1 mb-4 h-6 items-end">
      {Array.from({ length: 32 }).map((_, i) => {
        const h = active
          ? 4 + Math.abs(Math.sin((i + tick) * 0.5)) * 18
          : 4 + Math.abs(Math.sin(i * 0.6)) * 4;
        const color =
          state === "recording" ? "bg-red-400" : state === "speaking" ? "bg-[var(--gold)]" : "bg-[var(--gold)]/50";
        return (
          <span
            key={i}
            className={`w-1 rounded-full ${color} transition-all`}
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const time = msg.ts.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="h-9 w-9 rounded-full bg-[oklch(0.95_0.05_75)] flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-[var(--gold)]" />
        </div>
      )}
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-[var(--gold)] text-white"
            : "bg-card border border-border text-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap">{msg.content}</div>
        <div className={`text-xs mt-1 ${isUser ? "text-white/70" : "text-muted-foreground"}`}>
          {time}
        </div>
      </div>
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip "data:...;base64," prefix
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
