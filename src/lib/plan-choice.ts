// Remembers which plan a visitor clicked before signing up, so checkout can
// open for that plan once they're signed in (even after confirming their email
// on another device, via user_metadata.chosen_plan).
//
// UI PREFERENCE ONLY. This value is user-controlled and must NEVER be used for
// billing, entitlements or authorization. Plan access always comes from the
// subscription's price on the server.
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isPlanId, type PlanId } from "@/lib/plans";

const KEY = "askjanice.chosen-plan";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function rememberPlanChoice(id: PlanId): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ id, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

function readLocal(): PlanId | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown; at?: unknown };
    if (typeof parsed?.id !== "string" || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > MAX_AGE_MS || parsed.at > Date.now() + 60_000) return null;
    return isPlanId(parsed.id) ? parsed.id : null;
  } catch {
    return null;
  }
}

export function readPlanChoice(user: User | null | undefined): PlanId | null {
  const local = readLocal();
  if (local) return local;
  const meta = user?.user_metadata?.chosen_plan;
  return typeof meta === "string" && isPlanId(meta) ? meta : null;
}

export function clearPlanChoice(user: User | null | undefined): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  if (user?.user_metadata?.chosen_plan) {
    void supabase.auth
      .updateUser({ data: { chosen_plan: null } })
      .then(({ error }) => {
        if (error) console.warn("[plan-choice] could not clear chosen_plan", error.message);
      }, (e) => console.warn("[plan-choice] could not clear chosen_plan", e));
  }
}
