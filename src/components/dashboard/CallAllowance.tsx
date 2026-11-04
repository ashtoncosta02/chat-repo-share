import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPlanAccess } from "@/lib/plan-access.functions";
import { planForPrice } from "@/lib/plans";

export function CallAllowance() {
  const fetchAccess = useServerFn(getPlanAccess);
  const [access, setAccess] = useState<Awaited<ReturnType<typeof getPlanAccess>> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { void fetchAccess().then(setAccess).catch(() => setFailed(true)); },[fetchAccess]);
  const plan = planForPrice(access?.priceId);
  if (failed) return <p className="mt-4 text-sm text-muted-foreground">Call usage is temporarily unavailable.</p>;
  if (!access || !plan) return null;
  return <div className="mt-4 border-t border-border pt-4"><p className="text-sm font-medium">{plan.name}: {Math.ceil(access.usedSeconds/60)} / {plan.callMinutes} call minutes</p><p className="mt-1 text-xs text-muted-foreground">Resets {new Date(access.resetsAt).toLocaleDateString()}. Active calls reserve time until their final duration arrives.</p></div>;
}