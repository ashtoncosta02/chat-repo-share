// Pure helper: who the conversation was with. Phone calls carry the number in
// metadata.phone_call; text conversations in metadata.sms or system__caller_id.
export interface CallerNumberSource {
  metadata?: {
    phone_call?: { external_number?: string | null } | null;
    sms?: { sms_user_phone_number?: string | null } | null;
  } | null;
  conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> | null } | null;
}

export function callerNumberFrom(data: CallerNumberSource | null | undefined): string | null {
  const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return (
    pick(data?.metadata?.phone_call?.external_number) ??
    pick(data?.metadata?.sms?.sms_user_phone_number) ??
    pick(data?.conversation_initiation_client_data?.dynamic_variables?.system__caller_id) ??
    null
  );
}
