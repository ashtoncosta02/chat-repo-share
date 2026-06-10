import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ conversationId: z.string().uuid() });

/**
 * Mint a short-lived signed URL for a call recording.
 * RLS on `conversations` enforces ownership — we read the recording_url path
 * via the user-scoped client, then admin-sign it for playback.
 */
export const getCallRecordingUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: conv, error } = await supabase
      .from("conversations")
      .select("recording_url")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (error || !conv?.recording_url) return { url: null as string | null };

    // Backwards-compat: legacy rows may still hold a full URL.
    if (/^https?:\/\//i.test(conv.recording_url)) {
      return { url: conv.recording_url };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("call-audio")
      .createSignedUrl(conv.recording_url, 60 * 60);
    return { url: signed?.signedUrl ?? null };
  });
