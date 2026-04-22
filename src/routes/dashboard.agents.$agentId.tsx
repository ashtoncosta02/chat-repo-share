import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAgent } from "@/server/agent-chat";
import { speakText, transcribeAudio } from "@/server/agent-voice";
import { extractLeadFromChat } from "@/server/agent-lead-extract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mic, MicOff, Send, Bot, ArrowLeft, Calendar, Clock, Volume2, VolumeX, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PhoneNumberSetup } from "@/components/dashboard/PhoneNumberSetup";

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
  const extractLead = useServerFn(extractLeadFromChat);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [edit, setEdit] = useState({
    business_name: "",
    assistant_name: "",
    tone: "",
    primary_goal: "",
    services: "",
    booking_link: "",
    emergency_number: "",
    faqs: "",
    pricing_notes: "",
    escalation_triggers: "",
  });
  const navigate = useNavigate();

  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const conversationPromiseRef = useRef<Promise<string | null> | null>(null);
  const conversationStartRef = useRef<Date | null>(null);
  const messageCountRef = useRef<number>(0);
  const greetingPersistedRef = useRef(false);
  const leadIdRef = useRef<string | null>(null);
  const leadDataRef = useRef<{ name?: string | null; phone?: string | null; email?: string | null; notes?: string | null }>({});

  // Ensure exactly one conversation row exists for this session.
  // Uses a promise guard so concurrent callers (e.g. StrictMode double-invoke)
  // share the same insert instead of each creating a duplicate row.
  const ensureConversation = (): Promise<string | null> => {
    if (conversationIdRef.current) return Promise.resolve(conversationIdRef.current);
    if (conversationPromiseRef.current) return conversationPromiseRef.current;
    if (!user) return Promise.resolve(null);

    const startedAt = new Date();
    conversationStartRef.current = startedAt;
    const p: Promise<string | null> = (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          agent_id: agentId,
          started_at: startedAt.toISOString(),
          message_count: 0,
          duration_seconds: 0,
        })
        .select("id")
        .single();
      if (error || !data) {
        console.error("create conversation failed", error);
        conversationPromiseRef.current = null;
        return null;
      }
      conversationIdRef.current = data.id;
      return data.id;
    })();
    conversationPromiseRef.current = p;
    return p;
  };

  // Persist a single message to the DB (best-effort, non-blocking UX)
  const persistMessage = async (role: "user" | "assistant", content: string) => {
    if (!user) return;
    try {
      const convId = await ensureConversation();
      if (!convId) return;

      messageCountRef.current += 1;

      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: convId,
        user_id: user.id,
        role,
        content,
      });
      if (msgErr) console.error("insert message failed", msgErr);

      const start = conversationStartRef.current ?? new Date();
      const duration = Math.max(0, Math.round((Date.now() - start.getTime()) / 1000));
      const { error: updErr } = await supabase
        .from("conversations")
        .update({
          message_count: messageCountRef.current,
          duration_seconds: duration,
          ended_at: new Date().toISOString(),
        })
        .eq("id", convId);
      if (updErr) console.error("update conversation failed", updErr);
    } catch (e) {
      console.error("persistMessage error", e);
    }
  };

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
          // Persist greeting only once (StrictMode runs this effect twice in dev)
          if (!greetingPersistedRef.current) {
            greetingPersistedRef.current = true;
            persistMessage("assistant", greeting);
            if (voiceOn) playReply(greeting);
          }
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

  // Run lead extraction on the recent transcript and upsert/merge a single
  // lead row per conversation. Best-effort, never blocks the chat UX.
  const tryExtractLead = async (history: Msg[]) => {
    if (!user || !agent) return;
    try {
      const recent = history.slice(-12).map((m) => ({ role: m.role, content: m.content }));
      const res = await extractLead({ data: { messages: recent } });
      if (!res.success || !res.lead) return;
      const incoming = res.lead;

      // Merge with what we already captured, preferring non-empty new values.
      const merged = {
        name: pickStr(incoming.name, leadDataRef.current.name),
        phone: pickStr(incoming.phone, leadDataRef.current.phone),
        email: pickStr(incoming.email, leadDataRef.current.email),
        notes: pickStr(incoming.notes, leadDataRef.current.notes),
      };

      // Skip update if nothing new was captured
      const same =
        merged.name === leadDataRef.current.name &&
        merged.phone === leadDataRef.current.phone &&
        merged.email === leadDataRef.current.email &&
        merged.notes === leadDataRef.current.notes;
      if (same) return;

      leadDataRef.current = merged;

      if (!leadIdRef.current) {
        const { data, error } = await supabase
          .from("leads")
          .insert({
            user_id: user.id,
            agent_id: agent.id,
            name: merged.name ?? null,
            phone: merged.phone ?? null,
            email: merged.email ?? null,
            notes: merged.notes ?? null,
          })
          .select("id")
          .single();
        if (error) {
          console.error("create lead failed", error);
          return;
        }
        leadIdRef.current = data.id;
      } else {
        const { error } = await supabase
          .from("leads")
          .update({
            name: merged.name ?? null,
            phone: merged.phone ?? null,
            email: merged.email ?? null,
            notes: merged.notes ?? null,
          })
          .eq("id", leadIdRef.current);
        if (error) console.error("update lead failed", error);
      }
    } catch (e) {
      console.error("tryExtractLead error", e);
    }
  };

  const sendText = async (text: string) => {
    if (!text.trim() || !agent || sending) return;
    const userMsg: Msg = { role: "user", content: text.trim(), ts: new Date() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    // Persist user message (fire-and-forget)
    persistMessage("user", userMsg.content);
    // Try to extract lead info from the conversation so far (non-blocking)
    tryExtractLead([...messages, userMsg]);
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
      persistMessage("assistant", res.reply);
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEdit({
                business_name: agent.business_name ?? "",
                assistant_name: agent.assistant_name ?? "",
                tone: agent.tone ?? "",
                primary_goal: agent.primary_goal ?? "",
                services: agent.services ?? "",
                booking_link: agent.booking_link ?? "",
                emergency_number: agent.emergency_number ?? "",
                faqs: agent.faqs ?? "",
                pricing_notes: agent.pricing_notes ?? "",
                escalation_triggers: agent.escalation_triggers ?? "",
              });
              setEditOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
          </Button>
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

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit agent</DialogTitle>
            <DialogDescription>
              Update what your AI agent knows about your business.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ed-bn">Business name</Label>
                <Input
                  id="ed-bn"
                  value={edit.business_name}
                  onChange={(e) => setEdit({ ...edit, business_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ed-an">Assistant name</Label>
                <Input
                  id="ed-an"
                  value={edit.assistant_name}
                  onChange={(e) => setEdit({ ...edit, assistant_name: e.target.value })}
                  placeholder="Ava"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ed-tone">Tone</Label>
                <Input
                  id="ed-tone"
                  value={edit.tone}
                  onChange={(e) => setEdit({ ...edit, tone: e.target.value })}
                  placeholder="Friendly, professional"
                />
              </div>
              <div>
                <Label htmlFor="ed-goal">Primary goal</Label>
                <Input
                  id="ed-goal"
                  value={edit.primary_goal}
                  onChange={(e) => setEdit({ ...edit, primary_goal: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ed-svc">Services</Label>
              <Textarea
                id="ed-svc"
                value={edit.services}
                onChange={(e) => setEdit({ ...edit, services: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="ed-faq">FAQs</Label>
              <Textarea
                id="ed-faq"
                value={edit.faqs}
                onChange={(e) => setEdit({ ...edit, faqs: e.target.value })}
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="ed-pricing">Pricing notes</Label>
              <Textarea
                id="ed-pricing"
                value={edit.pricing_notes}
                onChange={(e) => setEdit({ ...edit, pricing_notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ed-book">Booking link</Label>
                <Input
                  id="ed-book"
                  value={edit.booking_link}
                  onChange={(e) => setEdit({ ...edit, booking_link: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ed-emer">Emergency number</Label>
                <Input
                  id="ed-emer"
                  value={edit.emergency_number}
                  onChange={(e) => setEdit({ ...edit, emergency_number: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ed-esc">Escalation triggers</Label>
              <Textarea
                id="ed-esc"
                value={edit.escalation_triggers}
                onChange={(e) => setEdit({ ...edit, escalation_triggers: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              disabled={saving || !edit.business_name.trim()}
              className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
              onClick={async () => {
                if (!user) return;
                setSaving(true);
                const payload = {
                  business_name: edit.business_name.trim(),
                  assistant_name: edit.assistant_name.trim() || null,
                  tone: edit.tone.trim() || null,
                  primary_goal: edit.primary_goal.trim() || null,
                  services: edit.services.trim() || null,
                  booking_link: edit.booking_link.trim() || null,
                  emergency_number: edit.emergency_number.trim() || null,
                  faqs: edit.faqs.trim() || null,
                  pricing_notes: edit.pricing_notes.trim() || null,
                  escalation_triggers: edit.escalation_triggers.trim() || null,
                };
                const { error } = await supabase
                  .from("agents")
                  .update(payload)
                  .eq("id", agent.id);
                setSaving(false);
                if (error) {
                  toast.error("Couldn't save changes", { description: error.message });
                  return;
                }
                setAgent({ ...agent, ...payload });
                setEditOpen(false);
                toast.success("Agent updated");
              }}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{agent.business_name}</strong> along with its
              conversations, messages, and leads. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!user) return;
                setDeleting(true);
                // Clean up dependent rows first (no FK cascade defined).
                const { data: convs } = await supabase
                  .from("conversations")
                  .select("id")
                  .eq("agent_id", agent.id);
                const convIds = (convs ?? []).map((c) => c.id);
                if (convIds.length > 0) {
                  await supabase.from("messages").delete().in("conversation_id", convIds);
                  await supabase.from("conversations").delete().in("id", convIds);
                }
                await supabase.from("leads").delete().eq("agent_id", agent.id);
                const { error } = await supabase.from("agents").delete().eq("id", agent.id);
                setDeleting(false);
                if (error) {
                  toast.error("Couldn't delete agent", { description: error.message });
                  return;
                }
                toast.success("Agent deleted");
                navigate({ to: "/dashboard" });
              }}
            >
              {deleting ? "Deleting…" : "Delete agent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

// Prefer the first non-empty trimmed string; falls back to the second.
function pickStr(
  next: string | null | undefined,
  prev: string | null | undefined,
): string | null {
  const n = next?.trim();
  if (n) return n;
  const p = prev?.trim();
  if (p) return p;
  return null;
}
