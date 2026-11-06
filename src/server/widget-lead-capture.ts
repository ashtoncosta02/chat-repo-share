// Backwards-compatible wrapper around the unified lead-extraction helper.
import { captureLead } from "@/server/lead-extraction";

interface CaptureArgs {
  agentId: string;
  userId: string;
  conversationId: string | null;
  messages: { role: "user" | "assistant"; content: string }[];
}

export async function captureLeadFromWidget(args: CaptureArgs): Promise<{ ok: boolean; leadId: string | null }> {
  return captureLead({
    agentId: args.agentId,
    userId: args.userId,
    conversationId: args.conversationId,
    source: "widget",
    newInquiry: true,
    messages: args.messages,
  });
}
