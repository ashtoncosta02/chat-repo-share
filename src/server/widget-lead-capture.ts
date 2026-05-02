// Backwards-compatible wrapper around the unified lead-extraction helper.
import { captureLead } from "@/server/lead-extraction";

interface CaptureArgs {
  agentId: string;
  userId: string;
  conversationId: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export async function captureLeadFromWidget(args: CaptureArgs): Promise<void> {
  await captureLead({
    agentId: args.agentId,
    userId: args.userId,
    conversationId: args.conversationId,
    source: "widget",
    messages: args.messages,
  });
}
