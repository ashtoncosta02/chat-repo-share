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