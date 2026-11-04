export const TRIAL_DAYS = 7;
export const PLANS = {
  essential_monthly: { name: "Essential", monthlyPrice: 79, callMinutes: 200, scenarioLimit: 3, humanTransfer: false, futureEmail: false },
  elite_monthly: { name: "Elite", monthlyPrice: 139, callMinutes: 750, scenarioLimit: null, humanTransfer: true, futureEmail: true },
} as const;
export type PlanId = keyof typeof PLANS;
export function isPlanId(value: string): value is PlanId {
  return value === "essential_monthly" || value === "elite_monthly";
}
export function planForPrice(value: string | undefined | null) {
  return value && isPlanId(value) ? PLANS[value] : null;
}
export function validatePlanScenarios(priceId: string, scenarios: Array<{ action?: { type?: string } }>) {
  const plan = planForPrice(priceId);
  if (!plan) throw new Error("Select an active plan before saving scenarios.");
  if (plan.scenarioLimit !== null && scenarios.length > plan.scenarioLimit) throw new Error("Essential includes up to 3 scenarios. Choose Elite for more.");
  if (!plan.humanTransfer && scenarios.some(s => s.action?.type === "call_transfer")) throw new Error("Instant human transfer is available on Elite only.");
}