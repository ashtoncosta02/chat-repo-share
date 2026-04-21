import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/PageHeader";
import { User, Phone, Mail } from "lucide-react";

export const Route = createFileRoute("/dashboard/leads")({
  head: () => ({ meta: [{ title: "Leads — Agent Factory" }] }),
  component: LeadsPage,
});

interface LeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("leads")
      .select("id, name, phone, email, notes, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLeads(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const withPhone = leads.filter((l) => l.phone).length;
  const withEmail = leads.filter((l) => l.email).length;

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Contact info captured automatically from conversations"
      />
      <div className="p-8 space-y-6">
        <div className="rounded-xl border border-[oklch(0.85_0.08_75)] bg-[oklch(0.97_0.04_80)] p-5 flex items-start gap-3">
          <span className="text-[var(--gold)] text-xl">✨</span>
          <div>
            <div className="font-semibold text-foreground mb-1">Automatic Lead Capture</div>
            <p className="text-sm text-muted-foreground">
              When someone shares their name, phone, or email with your AI agent, it
              automatically appears here. Click the phone number to call them back instantly.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatRow label="Total Leads" value={leads.length} color="text-foreground" />
          <StatRow label="With Phone" value={withPhone} color="text-emerald-600" />
          <StatRow label="With Email" value={withEmail} color="text-blue-600" />
        </div>

        <div className="rounded-xl border border-border bg-card">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : leads.length === 0 ? (
            <EmptyState
              icon={<User className="h-16 w-16 text-muted-foreground/40" />}
              title="No leads yet"
              description="Leads show up here automatically when someone shares their contact info with your AI agent."
            />
          ) : (
            <ul className="divide-y divide-border">
              {leads.map((l) => (
                <li key={l.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-foreground">{l.name ?? "Unknown"}</div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      {l.phone && (
                        <a href={`tel:${l.phone}`} className="flex items-center gap-1 hover:text-[var(--gold)]">
                          <Phone className="h-3 w-3" />
                          {l.phone}
                        </a>
                      )}
                      {l.email && (
                        <a href={`mailto:${l.email}`} className="flex items-center gap-1 hover:text-[var(--gold)]">
                          <Mail className="h-3 w-3" />
                          {l.email}
                        </a>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className={`font-display text-3xl font-semibold ${color}`}>{value}</span>
    </div>
  );
}
