import { describe, expect, it } from "vitest";
import { PLANS, TRIAL_DAYS, validatePlanScenarios } from "./plans";
describe("requested plan rules", () => {
  it("Essential is 79 a month", () => expect(PLANS.essential_monthly.monthlyPrice).toBe(79));
  it("Elite is 139 a month", () => expect(PLANS.elite_monthly.monthlyPrice).toBe(139));
  it("Essential includes 200 monthly minutes", () => expect(PLANS.essential_monthly.callMinutes).toBe(200));
  it("Elite includes 750 monthly minutes", () => expect(PLANS.elite_monthly.callMinutes).toBe(750));
  it("Essential accepts 3 scenarios but rejects 4", () => { expect(() => validatePlanScenarios("essential_monthly",Array.from({length:3},()=>({action:null})))).not.toThrow(); expect(() => validatePlanScenarios("essential_monthly",Array.from({length:4},()=>({action:null})))).toThrow(); });
  it("Essential rejects human transfer", () => expect(() => validatePlanScenarios("essential_monthly",[{action:{type:"call_transfer"}}])).toThrow());
  it("Elite allows transfer and more scenarios", () => expect(() => validatePlanScenarios("elite_monthly",Array.from({length:8},()=>({action:{type:"call_transfer"}})))).not.toThrow());
  it("both plans use a 7 day trial", () => expect(TRIAL_DAYS).toBe(7));
  it("future email integration belongs to Elite", () => { expect(PLANS.elite_monthly.futureEmail).toBe(true); expect(PLANS.essential_monthly.futureEmail).toBe(false); });
});
import { scenariosForPlan } from "./scenarios";
describe("scenariosForPlan", () => {
  const sc = (id: string, action: unknown = null) => ({ id, intent: id, steps: [], action });
  const transfer = { type: "call_transfer", phone: "+14165550100" };
  const raw = [sc("a", transfer), sc("b"), sc("c"), sc("d", { type: "post_call_sms", message: "hi" }), sc("e", transfer)];
  it("Essential keeps the first 3 and strips call_transfer", () => {
    const out = scenariosForPlan(raw, PLANS.essential_monthly);
    expect(out.map(s => s.id)).toEqual(["a", "b", "c"]);
    expect(out[0].action).toBeNull();
  });
  it("Elite keeps all, including transfers", () => {
    const out = scenariosForPlan(raw, PLANS.elite_monthly);
    expect(out.map(s => s.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(out[0].action?.type).toBe("call_transfer");
    expect(out[4].action?.type).toBe("call_transfer");
  });
  it("Essential drops a post_call_sms scenario beyond position 3", () => {
    const out = scenariosForPlan(raw, PLANS.essential_monthly);
    expect(out.some(s => s.action?.type === "post_call_sms")).toBe(false);
  });
});
