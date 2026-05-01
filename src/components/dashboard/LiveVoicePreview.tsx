import { useState, useCallback } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Mic, PhoneOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  syncReceptionistAgent,
  getReceptionistPreviewToken,
} from "@/server/elevenlabs-agent.functions";

interface LiveVoicePreviewProps {
  agentId: string;
  hasElevenLabsAgent: boolean;
  /** Called once we successfully provision the EL agent for the first time. */
  onProvisioned?: () => void;
}

/**
 * Real-time voice preview using the same ElevenLabs agent that handles
 * inbound phone calls. What the user hears here is exactly what callers hear.
 */
export function LiveVoicePreview(props: LiveVoicePreviewProps) {
  return (
    <ConversationProvider>
      <LiveVoicePreviewInner {...props} />
    </ConversationProvider>
  );
}

function LiveVoicePreviewInner({
  agentId,
  hasElevenLabsAgent,
  onProvisioned,
}: LiveVoicePreviewProps) {
  const { user } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const sync = useServerFn(syncReceptionistAgent);
  const getToken = useServerFn(getReceptionistPreviewToken);

  const conversation = useConversation({
    onConnect: () => {
      // No toast — visual state in the button is enough.
    },
    onDisconnect: () => {
      // Same.
    },
    onError: (err) => {
      console.error("EL conversation error:", err);
      const msg = typeof err === "string" ? err : (err as { message?: string })?.message;
      toast.error("Voice connection error", { description: msg });
    },
  });

  const status = conversation.status;
  const isConnected = status === "connected";
  const isSpeaking = conversation.isSpeaking;

  const start = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in again.");
      return;
    }
    setIsStarting(true);
    try {
      const { data: session } = await import("@/integrations/supabase/client").then((m) =>
        m.supabase.auth.getSession(),
      );
      const token = session.session?.access_token;
      if (!token) throw new Error("No session token. Sign in again.");

      // 1. Make sure the EL agent exists / is up to date.
      if (!hasElevenLabsAgent) {
        const r = await sync({ data: { accessToken: token, agentId } });
        if (!r.success) throw new Error(r.error);
        onProvisioned?.();
      }

      // 2. Get a short-lived token + signed URL.
      const t = await getToken({ data: { accessToken: token, agentId } });
      if (!t.success) throw new Error(t.error);

      // 3. Ask for mic permission.
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // 4. Open the session. Prefer WebRTC — it streams audio natively and
      // sounds noticeably smoother than WebSocket (which chunk-decodes audio
      // and tends to introduce glitches). Fall back to WebSocket if WebRTC
      // can't be negotiated (rare, but happens in some sandboxed iframes).
      if (t.token) {
        try {
          await conversation.startSession({
            conversationToken: t.token,
            connectionType: "webrtc",
          });
        } catch (rtcErr) {
          console.warn("WebRTC failed, falling back to WebSocket:", rtcErr);
          if (!t.signedUrl) throw rtcErr;
          await conversation.startSession({
            signedUrl: t.signedUrl,
            connectionType: "websocket",
          });
        }
      } else if (t.signedUrl) {
        await conversation.startSession({
          signedUrl: t.signedUrl,
          connectionType: "websocket",
        });
      } else {
        throw new Error("No connection credentials returned.");
      }
    } catch (e) {
      console.error("LiveVoicePreview start failed:", e);
      toast.error("Couldn't start voice test", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsStarting(false);
    }
  }, [agentId, conversation, getToken, hasElevenLabsAgent, onProvisioned, sync, user]);

  const stop = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (e) {
      console.error("End session error:", e);
    }
  }, [conversation]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center gap-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">Live voice test</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Talk to your receptionist exactly the way callers will.
        </p>
      </div>

      <div
        className={`h-24 w-24 rounded-full flex items-center justify-center transition-all ${
          isConnected
            ? isSpeaking
              ? "bg-[var(--gold)]/20 border-2 border-[var(--gold)] animate-pulse scale-105"
              : "bg-emerald-500/10 border-2 border-emerald-500"
            : "bg-muted border-2 border-border"
        }`}
      >
        {isStarting ? (
          <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
        ) : isConnected ? (
          <Mic className="h-10 w-10 text-emerald-600" />
        ) : (
          <Mic className="h-10 w-10 text-muted-foreground" />
        )}
      </div>

      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {isStarting
          ? "Connecting…"
          : isConnected
            ? isSpeaking
              ? "Receptionist speaking…"
              : "Listening…"
            : "Tap to start"}
      </div>

      {isConnected ? (
        <Button
          onClick={stop}
          variant="destructive"
          className="rounded-full px-6"
        >
          <PhoneOff className="h-4 w-4 mr-2" />
          End call
        </Button>
      ) : (
        <Button
          onClick={start}
          disabled={isStarting}
          className="rounded-full px-6 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
        >
          <Mic className="h-4 w-4 mr-2" />
          {hasElevenLabsAgent ? "Start voice test" : "Provision & test"}
        </Button>
      )}

      {!hasElevenLabsAgent && !isStarting && (
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          First test takes a few extra seconds while we provision your voice agent.
        </p>
      )}
    </div>
  );
}
