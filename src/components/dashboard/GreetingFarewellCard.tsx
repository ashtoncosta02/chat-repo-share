import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { syncReceptionistAgent } from "@/lib/elevenlabs-agent.functions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  agentId: string;
  businessName: string;
  assistantName: string;
  greeting: string | null;
  farewell: string | null;
  onSaved: (next: { greeting: string | null; farewell: string | null }) => void;
}

/**
 * Edit the AI receptionist's opening greeting and closing farewell.
 * Saving persists to the agents table and re-syncs the live ElevenLabs agent
 * so phone callers immediately hear the new lines.
 */
export function GreetingFarewellCard({
  agentId,
  businessName,
  assistantName,
  greeting,
  farewell,
  onSaved,
}: Props) {
  const syncEl = useServerFn(syncReceptionistAgent);
  const greetingPlaceholder = `Hi, this is ${assistantName} from ${businessName}. How can I help you?`;
  const farewellPlaceholder = `Thanks for calling ${businessName}! Have a great day.`;
  const [greetingDraft, setGreetingDraft] = useState<string>(greeting ?? "");
  const [farewellDraft, setFarewellDraft] = useState<string>(farewell ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGreetingDraft(greeting ?? "");
  }, [greeting]);
  useEffect(() => {
    setFarewellDraft(farewell ?? "");
  }, [farewell]);

  const dirty =
    greetingDraft.trim() !== (greeting ?? "").trim() ||
    farewellDraft.trim() !== (farewell ?? "").trim();

  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    const nextGreeting = greetingDraft.trim() || null;
    const nextFarewell = farewellDraft.trim() || null;
    const { error } = await supabase
      .from("agents")
      .update({ greeting_message: nextGreeting, farewell_message: nextFarewell })
      .eq("id", agentId);
    if (error) {
      setSaving(false);
      toast.error("Couldn't save messages", { description: error.message });
      return;
    }
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (token) await syncEl({ data: { accessToken: token, agentId } });
    } catch (e) {
      console.error("EL sync exception:", e);
    }
    onSaved({ greeting: nextGreeting, farewell: nextFarewell });
    setSaving(false);
    toast.success("Greeting & farewell updated");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5 flex items-start gap-2">
        <MessageCircle className="h-5 w-5 text-[var(--gold)] mt-0.5" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">Greeting & farewell</h3>
          <p className="text-sm text-muted-foreground">
            Customize the first and last thing your AI receptionist says on every call.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <Label htmlFor="greeting-msg" className="text-sm font-semibold">
            Greeting message
          </Label>
          <p className="text-xs text-muted-foreground mb-2">How your AI starts conversations</p>
          <Textarea
            id="greeting-msg"
            rows={3}
            value={greetingDraft}
            onChange={(e) => setGreetingDraft(e.target.value)}
            placeholder={greetingPlaceholder}
          />
        </div>

        <div>
          <Label htmlFor="farewell-msg" className="text-sm font-semibold">
            Farewell message
          </Label>
          <p className="text-xs text-muted-foreground mb-2">What the AI says before ending a call</p>
          <Textarea
            id="farewell-msg"
            rows={3}
            value={farewellDraft}
            onChange={(e) => setFarewellDraft(e.target.value)}
            placeholder={farewellPlaceholder}
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white"
          >
            {saving ? "Saving…" : "Save messages"}
          </Button>
        </div>
      </div>
    </div>
  );
}
