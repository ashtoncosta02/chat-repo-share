import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/PageHeader";
import { Phone, Bot, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { syncTwilioWebhooks } from "@/server/twilio-numbers";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/phone-numbers")({
  head: () => ({ meta: [{ title: "Phone Numbers — Agent Factory" }] }),
  component: PhoneNumbersPage,
});

interface NumberRow {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  locality: string | null;
  region: string | null;
  postal_code: string | null;
  agent_id: string | null;
  created_at: string;
  agents: { business_name: string } | null;
}

function formatPhone(e164: string): string {
  const m = e164.match(/^\+(\d)(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
}

function PhoneNumbersPage() {
  const { user } = useAuth();
  const [numbers, setNumbers] = useState<NumberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const sync = useServerFn(syncTwilioWebhooks);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("phone_numbers")
      .select(
        "id, phone_number, friendly_name, locality, region, postal_code, agent_id, created_at, agents(business_name)"
      )
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setNumbers((data ?? []) as unknown as NumberRow[]);
        setLoading(false);
      });
  }, [user]);

  async function handleSync(phoneNumberId: string) {
    setSyncingId(phoneNumberId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast.error("Please sign in again.");
        return;
      }
      const res = await sync({ data: { accessToken, phoneNumberId } });
      if (res.success) {
        toast.success("Voice & SMS webhooks updated. Try calling the number now.");
      } else {
        toast.error(res.error);
      }
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Phone Numbers"
        description="Real phone numbers connected to your AI agents"
      />
      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        <div className="rounded-xl border border-[oklch(0.85_0.08_75)] bg-[oklch(0.97_0.04_80)] p-4 md:p-5 flex items-start gap-3">
          <Phone className="h-5 w-5 text-[var(--gold)] flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-foreground mb-1">Give your agents a real number</div>
            <p className="text-sm text-muted-foreground">
              Open any agent and choose a phone number by ZIP code. Numbers you've claimed appear here.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : numbers.length === 0 ? (
            <EmptyState
              icon={<Phone className="h-16 w-16 text-muted-foreground/40" />}
              title="No phone numbers yet"
              description="Open one of your agents to search for a number by ZIP code and claim it instantly."
              action={
                <Link to="/dashboard">
                  <Button className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white">
                    Go to Agents
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {numbers.map((n) => (
                <li key={n.id} className="px-4 md:px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-base md:text-lg font-semibold text-foreground">
                        {formatPhone(n.phone_number)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {[n.locality, n.region, n.postal_code].filter(Boolean).join(", ") || "Active"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {n.agent_id ? (
                        <Link
                          to="/dashboard/agents/$agentId"
                          params={{ agentId: n.agent_id }}
                          className="flex items-center gap-1.5 text-sm text-[var(--gold-foreground)] hover:underline"
                        >
                          <Bot className="h-3.5 w-3.5" />
                          {n.agents?.business_name || "View agent"}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSync(n.id)}
                        disabled={syncingId === n.id}
                        title="Re-point Twilio's voice & SMS webhooks at this app"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncingId === n.id ? "animate-spin" : ""}`} />
                        {syncingId === n.id ? "Syncing…" : "Sync webhooks"}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
