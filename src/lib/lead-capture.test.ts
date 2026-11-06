import { describe, expect, it } from "vitest";
import { callerNumberFrom } from "./caller-number";
import { mergeLeadNotes, looksLikeContact } from "./lead-notes";
import { allowanceResponseBody } from "./call-allowance-decision";

describe("callerNumberFrom", () => {
  it("uses the phone call number first", () => {
    expect(callerNumberFrom({ metadata: { phone_call: { external_number: "+14165550100" }, sms: { sms_user_phone_number: "+14165550199" } } })).toBe("+14165550100");
  });
  it("uses the text sender for a text conversation", () => {
    expect(callerNumberFrom({ metadata: { sms: { sms_user_phone_number: "+14165550199" } } })).toBe("+14165550199");
  });
  it("falls back to system__caller_id", () => {
    expect(callerNumberFrom({ conversation_initiation_client_data: { dynamic_variables: { system__caller_id: "+14165550123" } } })).toBe("+14165550123");
  });
  it("returns null when nothing is known", () => {
    expect(callerNumberFrom({ metadata: {} })).toBeNull();
  });
});

describe("mergeLeadNotes", () => {
  it("puts the newest note first and keeps the old one", () => {
    expect(mergeLeadNotes("Wants a quote", "Asked about hours")).toBe("Wants a quote\n\nEarlier: Asked about hours");
  });
  it("is unchanged when the new note is empty", () => {
    expect(mergeLeadNotes("", "Asked about hours")).toBe("Asked about hours");
  });
  it("is unchanged when the new note is already at the start", () => {
    expect(mergeLeadNotes("Wants a quote", "Wants a quote\n\nEarlier: x")).toBe("Wants a quote\n\nEarlier: x");
  });
  it("caps at 2000 characters", () => {
    expect(mergeLeadNotes("a".repeat(1500), "b".repeat(1500))!.length).toBe(2000);
  });
});

describe("looksLikeContact", () => {
  it("spots a phone number", () => expect(looksLikeContact("call me at 416-555-0100")).toBe(true));
  it("spots an email", () => expect(looksLikeContact("me@example.com")).toBe(true));
  it("ignores ordinary text", () => expect(looksLikeContact("do you open at 9?")).toBe(false));
});

describe("call allowance decision", () => {
  it("refuses only a blocked caller or a denied allowance", () => {
    expect(allowanceResponseBody({ kind: "blocked" }).status).toBe(403);
    expect(allowanceResponseBody({ kind: "denied" }).status).toBe(403);
  });
  for (const kind of ["bad-request", "bad-credential", "error"] as const) {
    it(`lets the call through on ${kind} with 600s and empty variables`, () => {
      const r = allowanceResponseBody({ kind });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({
        type: "conversation_initiation_client_data",
        conversation_config_override: { conversation: { max_duration_seconds: 600 } },
        dynamic_variables: { call_direction: "inbound", lead_name: "", lead_notes: "", janice_call_reservation: "" },
      });
    });
  }
  it("passes the reservation through when reserved", () => {
    const r = allowanceResponseBody({ kind: "reserved", seconds: 420, reservationId: "res-1" });
    expect(r.status).toBe(200);
    expect((r.body as any).dynamic_variables.janice_call_reservation).toBe("res-1");
    expect((r.body as any).conversation_config_override.conversation.max_duration_seconds).toBe(420);
  });
});
