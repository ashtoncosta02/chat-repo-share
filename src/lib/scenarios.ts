// Helpers for the structured Scenario list stored on agents.scenarios (jsonb).

export type CollectFieldKey =
  | "name"
  | "business_name"
  | "phone"
  | "email"
  | "address";

export const COLLECT_FIELD_LABELS: Record<CollectFieldKey, string> = {
  name: "Name",
  business_name: "Business name",
  phone: "Phone number",
  email: "Email",
  address: "Address",
};

export interface ScenarioStepInstruction {
  id: string;
  kind: "instruction";
  text: string;
}

export interface ScenarioStepCollect {
  id: string;
  kind: "collect_info";
  fields: string[]; // CollectFieldKey values + custom labels
}

export type ScenarioStep = ScenarioStepInstruction | ScenarioStepCollect;

export type ScenarioAction =
  | { type: "call_transfer"; phone: string }
  | { type: "post_call_sms"; message: string }
  | { type: "schedule_appointment" }
  | null;

export interface StructuredScenario {
  id: string;
  intent: string;
  steps: ScenarioStep[];
  action: ScenarioAction;
}

export function newScenario(intent = ""): StructuredScenario {
  return { id: crypto.randomUUID(), intent, steps: [], action: null };
}

export function newInstructionStep(): ScenarioStepInstruction {
  return { id: crypto.randomUUID(), kind: "instruction", text: "" };
}

export function newCollectStep(): ScenarioStepCollect {
  return { id: crypto.randomUUID(), kind: "collect_info", fields: ["name", "phone"] };
}

export function coerceScenarios(raw: unknown): StructuredScenario[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): StructuredScenario | null => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const intent = typeof o.intent === "string" ? o.intent : "";
      const steps = Array.isArray(o.steps)
        ? (o.steps
            .map((s): ScenarioStep | null => {
              if (!s || typeof s !== "object") return null;
              const so = s as Record<string, unknown>;
              const id = typeof so.id === "string" ? so.id : crypto.randomUUID();
              if (so.kind === "collect_info") {
                const fields = Array.isArray(so.fields)
                  ? so.fields.filter((x): x is string => typeof x === "string")
                  : [];
                return { id, kind: "collect_info", fields };
              }
              return {
                id,
                kind: "instruction",
                text: typeof so.text === "string" ? so.text : "",
              };
            })
            .filter((x): x is ScenarioStep => x !== null))
        : [];
      let action: ScenarioAction = null;
      if (o.action && typeof o.action === "object") {
        const ao = o.action as Record<string, unknown>;
        if (ao.type === "call_transfer" && typeof ao.phone === "string") {
          action = { type: "call_transfer", phone: ao.phone };
        } else if (ao.type === "post_call_sms" && typeof ao.message === "string") {
          action = { type: "post_call_sms", message: ao.message };
        } else if (ao.type === "schedule_appointment") {
          action = { type: "schedule_appointment" };
        }
      }
      return {
        id: typeof o.id === "string" ? o.id : crypto.randomUUID(),
        intent,
        steps,
        action,
      };
    })
    .filter((x): x is StructuredScenario => x !== null);
}

export function fieldLabel(f: string): string {
  return (COLLECT_FIELD_LABELS as Record<string, string>)[f] ?? f;
}

/** Render scenarios as a prompt section for the voice/chat agent. */
export function scenariosToPromptText(scenarios: StructuredScenario[]): string {
  const usable = scenarios.filter((s) => s.intent.trim());
  if (usable.length === 0) return "";
  const blocks: string[] = [];
  for (const s of usable) {
    const parts: string[] = [];
    parts.push(`If the caller wants to ${s.intent.trim()}:`);
    s.steps.forEach((step, i) => {
      if (step.kind === "collect_info" && step.fields.length > 0) {
        parts.push(
          `  ${i + 1}. Collect: ${step.fields.map(fieldLabel).join(", ")}.`,
        );
      } else if (step.kind === "instruction" && step.text.trim()) {
        parts.push(`  ${i + 1}. ${step.text.trim()}`);
      }
    });
    if (s.action) {
      if (s.action.type === "call_transfer") {
        parts.push(`  Then offer to transfer them to ${s.action.phone}.`);
      } else if (s.action.type === "post_call_sms") {
        parts.push(
          `  Then let them know you'll text them right after this call. (SMS body: "${s.action.message.trim()}")`,
        );
      } else if (s.action.type === "schedule_appointment") {
        parts.push(`  Then schedule an appointment using the booking tool.`);
      }
    }
    blocks.push(parts.join("\n"));
  }
  return blocks.join("\n\n");
}

/** Suggested scenarios shown on the left rail. */
export const SCENARIO_SUGGESTIONS: string[] = [
  "request a quote",
  "book a consultation",
  "schedule a callback from the team",
  "leave a message about an existing job",
  "ask about pricing or availability",
  "report an urgent issue or emergency",
];
