import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Bot, CheckCircle2, Building2, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Dashboard — Agent Factory" }] }),
  component: DashboardHome,
});

interface AgentRow {
  id: string;
  business_name: string;
  industry: string | null;
  is_live: boolean;
  created_at: string;
}

function DashboardHome() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("agents")
      .select("id, business_name, industry, is_live, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAgents(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const total = agents.length;
  const live = agents.filter((a) => a.is_live).length;
  const industries = new Set(agents.map((a) => a.industry).filter(Boolean)).size;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Manage all your AI voice agents"
        action={
          <Link to="/dashboard/new-agent">
            <Button className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white">
              <Plus className="h-4 w-4 mr-2" />
              New Agent
            </Button>
          </Link>
        }
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={<Bot className="h-5 w-5 text-[var(--gold)]" />}
            iconBg="bg-[oklch(0.95_0.05_75)]"
            label="Total Agents"
            value={total}
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-100"
            label="Live"
            value={live}
            valueColor="text-emerald-600"
          />
          <StatCard
            icon={<Building2 className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
            label="Industries"
            value={industries}
            valueColor="text-blue-600"
          />
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="font-semibold text-foreground">Your Agents</h2>
            <Link to="/dashboard/new-agent">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Agent
              </Button>
            </Link>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : agents.length === 0 ? (
            <EmptyState
              icon={<Bot className="h-16 w-16 text-muted-foreground/40" />}
              title="No agents yet"
              description="Build your first AI voice agent. Paste in a business URL and we'll do the rest."
              action={
                <Link to="/dashboard/new-agent">
                  <Button className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white">
                    Build First Agent
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {agents.map((a) => (
                <li key={a.id}>
                  <Link
                    to="/dashboard/agents/$agentId"
                    params={{ agentId: a.id }}
                    className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition"
                  >
                    <div>
                      <div className="font-medium text-foreground">{a.business_name}</div>
                      {a.industry && (
                        <div className="text-sm text-muted-foreground">{a.industry}</div>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        a.is_live
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {a.is_live ? "Live" : "Draft"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
