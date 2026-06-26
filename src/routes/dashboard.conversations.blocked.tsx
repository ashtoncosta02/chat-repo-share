import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Ban, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listBlockedCallers, unblockCaller } from "@/lib/thread-actions.functions";

export const Route = createFileRoute("/dashboard/conversations/blocked")({
  head: () => ({ meta: [{ title: "Blocked callers — Ask Janice" }] }),
  component: BlockedCallersPage,
});

type BlockedRow = { id: string; phone: string; reason: string | null; created_at: string };

function BlockedCallersPage() {
  const [items, setItems] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listBlockedCallers();
      setItems((res?.items ?? []) as BlockedRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load blocked callers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleUnblock = async (phone: string) => {
    setBusy(phone);
    try {
      await unblockCaller({ data: { phone } });
      setItems((prev) => prev.filter((b) => b.phone !== phone));
      toast.success("Caller unblocked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unblock");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Blocked callers" description="Numbers that won't reach your receptionist." />
      <div className="p-8 space-y-4">
        <Link
          to="/dashboard/conversations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to threads
        </Link>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Ban className="h-16 w-16 text-muted-foreground/40" />}
              title="No blocked callers"
              description="When you block someone from the Threads page, they'll show up here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((b) => (
                <li key={b.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{b.phone}</div>
                    {b.reason && (
                      <div className="text-xs text-muted-foreground mt-0.5">{b.reason}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Blocked {new Date(b.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnblock(b.phone)}
                    disabled={busy === b.phone}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Unblock
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
