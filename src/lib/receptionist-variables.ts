// Dynamic variables the receptionist prompt, first message and tools may use.
// Every one MUST be supplied on every call (ElevenLabs drops the call when a
// referenced variable is missing). system__* variables come from ElevenLabs.
export const RECEPTIONIST_DYNAMIC_VARIABLES = ["call_direction", "lead_name", "lead_notes"] as const;

export type ReceptionistVariable = (typeof RECEPTIONIST_DYNAMIC_VARIABLES)[number];

/** Safe defaults for an inbound caller we know nothing about. */
export function defaultReceptionistVariables(): Record<ReceptionistVariable, string> {
  const out = {} as Record<ReceptionistVariable, string>;
  for (const k of RECEPTIONIST_DYNAMIC_VARIABLES) out[k] = k === "call_direction" ? "inbound" : "";
  return out;
}

/** Every {{variable}} referenced in a string. */
export function referencedVariables(text: string): string[] {
  return Array.from(text.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g), (m) => m[1]);
}

/** Turn any {{name}} we don't supply (and isn't system__) into plain text. */
export function stripUnknownVariables(text: string): string {
  const allowed = new Set<string>(RECEPTIONIST_DYNAMIC_VARIABLES);
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (m, name: string) =>
    allowed.has(name) || name.startsWith("system__") ? m : name,
  );
}

/** Variables used in text that are neither supplied by us nor system__ ones. */
export function unknownVariables(text: string): string[] {
  const allowed = new Set<string>(RECEPTIONIST_DYNAMIC_VARIABLES);
  return referencedVariables(text).filter((v) => !allowed.has(v) && !v.startsWith("system__"));
}
