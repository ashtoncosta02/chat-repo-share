import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("./voice-tool-auth.server", () => ({ VOICE_TOOL_HEADER: "x-janice-tool-key", voiceToolCredential: () => "test" }));
vi.mock("./widget-booking-tools", () => ({ buildBookingPromptAddendum: () => "", getCalendarConfig: async () => null }));

import {
  buildAgentPayload,
  buildBookToolConfig,
  buildFindSlotsToolConfig,
  buildFirstMessage,
  buildSystemPrompt,
  type AgentBusinessProfile,
} from "./elevenlabs-agent.server";
import { unknownVariables } from "@/lib/receptionist-variables";

const profile = {
  business_name: "Costa Caulking",
  assistant_name: "Janice",
  greeting_message: "",
  industry: "Home services",
  transfer_numbers: [{ phone: "+14165550100", condition: "asks for a person" }],
  tool_ids: ["t1"],
} as unknown as AgentBusinessProfile;

describe("receptionist prompt", () => {
  it("voicemail message contains no {{variable}}", () => {
    const vm = buildAgentPayload(profile).conversation_config.agent.prompt.built_in_tools?.voicemail_detection?.params.voicemail_message ?? "";
    expect(vm).toContain("Costa Caulking");
    expect(vm).not.toMatch(/\{\{/);
  });
  it("states the inbound rule", () => {
    const prompt = buildSystemPrompt(profile);
    expect(prompt).toContain("# Voicemail handling (OUTBOUND CALLBACKS ONLY)");
    expect(prompt).toContain('If call direction is "inbound" or empty, the caller is a live person. NEVER call voicemail_detection on an inbound call');
  });
  it("uses only supplied or system__ dynamic variables", () => {
    const payload = buildAgentPayload(profile);
    const texts = [
      buildSystemPrompt(profile),
      buildFirstMessage(profile),
      buildFirstMessage({ ...profile, greeting_message: "Hi from {{lead_name}}" } as AgentBusinessProfile),
      JSON.stringify(payload.conversation_config.agent.prompt.built_in_tools),
      JSON.stringify(buildFindSlotsToolConfig("agent-1")),
      JSON.stringify(buildBookToolConfig("agent-1")),
    ];
    for (const t of texts) expect(unknownVariables(t)).toEqual([]);
  });
});
