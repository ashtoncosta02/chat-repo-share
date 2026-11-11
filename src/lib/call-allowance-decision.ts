import { defaultReceptionistVariables } from "@/lib/receptionist-variables";
import { AI_CALL_MAX_SECONDS } from "@/lib/call-length";

// Pure decision for the inbound minutes check. Only a verified request whose
// caller is blocked, or whose account was denied by the allowance itself
// (over the limit / no plan), may refuse a call. Everything else — bad input,
// wrong credential, our own errors — lets the call through.
export type AllowanceOutcome =
  | { kind: "reserved"; seconds: number; reservationId: string }
  | { kind: "blocked" }
  | { kind: "denied" }
  | { kind: "bad-request" }
  | { kind: "bad-credential" }
  | { kind: "error" };

export const FALLBACK_MAX_SECONDS = AI_CALL_MAX_SECONDS;

export function allowanceResponseBody(o: AllowanceOutcome): { status: number; body: Record<string, unknown> | string; alert: boolean } {
  if (o.kind === "blocked") return { status: 403, body: "Caller blocked", alert: false };
  if (o.kind === "denied") return { status: 403, body: "Call allowance reached", alert: false };
  const seconds = o.kind === "reserved" ? o.seconds : FALLBACK_MAX_SECONDS;
  const reservationId = o.kind === "reserved" ? o.reservationId : "";
  return {
    status: 200,
    alert: o.kind !== "reserved",
    body: {
      type: "conversation_initiation_client_data",
      conversation_config_override: { conversation: { max_duration_seconds: seconds } },
      dynamic_variables: { ...defaultReceptionistVariables(), janice_call_reservation: reservationId },
    },
  };
}
