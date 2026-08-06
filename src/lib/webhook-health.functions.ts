import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ accessToken: z.string().min(1) });

export const getIntegrationCredentialHealth = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminUser } = await import("@/server/require-admin.server");
    const auth = await requireAdminUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { checkElevenLabsApiKey, checkWebhookSecret, listWebhookFailures } = await import(
      "@/server/webhook-health.server"
    );
    const [apiKey, webhookSecret, failures] = await Promise.all([
      checkElevenLabsApiKey(),
      checkWebhookSecret(),
      listWebhookFailures(25),
    ]);
    return { success: true as const, apiKey, webhookSecret, failures };
  });

export const replayFailedWebhooks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminUser } = await import("@/server/require-admin.server");
    const auth = await requireAdminUser(data.accessToken);
    if ("error" in auth) return { success: false as const, error: auth.error };

    const { replayWebhookFailures } = await import("@/server/webhook-health.server");
    const result = await replayWebhookFailures();
    return { success: true as const, ...result };
  });
