// How long a single call may run. The ledger only holds a small admission slot
// per call (so one long call never blocks other callers); the call's hard
// limit is set separately from the minutes the account has left.
export const RESERVATION_SLOT_SECONDS = 600;
export const AI_CALL_MAX_SECONDS = 1800;
export const DIALER_CALL_MAX_SECONDS = 14400;

/**
 * @param reserved seconds the ledger granted this call (already counted in usedSeconds)
 * @param usage plan cap and period usage, or null when it could not be read
 */
export function callMaxSeconds(
  reserved: number,
  perCallMax: number,
  usage: { capSeconds: number; usedSeconds: number } | null,
): number {
  // A slot smaller than the normal one means the account had only that much left.
  if (reserved < RESERVATION_SLOT_SECONDS) return reserved;
  // Our own lookup failed: never cut the caller short for it.
  if (!usage) return perCallMax;
  const remaining = Math.max(0, usage.capSeconds - usage.usedSeconds);
  return Math.max(reserved, Math.min(perCallMax, reserved + remaining));
}
