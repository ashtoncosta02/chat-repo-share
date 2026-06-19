import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PatchSchema = z.object({
  notify_email_transcript: z.boolean().optional(),
  notify_sms_transcript: z.boolean().optional(),
  notify_email: z.string().email().nullable().optional(),
  notify_phone: z.string().max(40).nullable().optional(),
});

export const updateAgentNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { data: rows, error } = await supabase
      .from("agents")
      .update(patch)
      .eq("user_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("No receptionist found for this account.");
    return { ok: true as const, updated: rows.length };
  });

export const getMyNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: agent, error } = await supabase
      .from("agents")
      .select("id, notify_email_transcript, notify_sms_transcript, notify_email, notify_phone")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      agent: agent ?? null,
      accountEmail: profile?.email ?? null,
    };
  });

export const sendTestTranscriptEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ to: z.string().email() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: agent } = await supabase
      .from("agents")
      .select("business_name")
      .eq("user_id", userId)
      .maybeSingle();
    const { sendEmail } = await import("@/server/email.server");
    const { renderTranscriptEmail } = await import("@/server/email-templates.server");
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://askjanice.net";
    const { subject, html } = renderTranscriptEmail({
      businessName: agent?.business_name || "Your business",
      callerNumber: "+1 (555) 123-4567",
      startedAt: new Date(),
      durationSeconds: 92,
      summary:
        "This is a test email from Janice. Caller asked about hours and booked a tasting for Saturday at 2pm.",
      turns: [
        { role: "assistant", content: "Thanks for calling — this is Janice. How can I help?" },
        { role: "user", content: "Hi, what time do you close today?" },
        { role: "assistant", content: "We're open until 6pm today. Would you like to book a tasting?" },
        { role: "user", content: "Yes, Saturday at 2pm works." },
        { role: "assistant", content: "Booked! You'll get a confirmation shortly." },
      ],
      conversationDashboardUrl: `${siteUrl}/dashboard/conversations`,
    });
    const id = await sendEmail({
      to: data.to,
      subject: `[TEST] ${subject}`,
      html,
    });
    if (!id) throw new Error("Email failed to send. Check the Resend connector or try again.");
    return { ok: true as const, id };
  });
