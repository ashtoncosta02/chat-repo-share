import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  accessToken: z.string().min(1),
  environment: z.enum(["sandbox", "live"]),
});

export const getAdminBillingSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminUser } = await import("@/server/require-admin.server");
    const auth = await requireAdminUser(data.accessToken);
    if ("error" in auth) return { ok: false as const, error: auth.error };

    const { getBillingSnapshot } = await import("@/server/admin-billing.server");
    return await getBillingSnapshot(data.environment);
  });
