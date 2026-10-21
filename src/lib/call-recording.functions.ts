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
    const { supabase, userId } = context;
    const { data: conv, error } = await supabase
      .from("conversations")
      .select("id, user_id, recording_url")
      .eq("id", data.conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !conv?.recording_url) return { url: null as string | null };

    // Backwards-compat: legacy rows may still hold a full URL.
    if (/^https?:\/\//i.test(conv.recording_url)) {
      return { url: conv.recording_url };
    }

    // Only sign files stored under this caller's own folder for this exact call
    // (format written by the post-call webhook: `${userId}/${conversationId}.ext`).
    const expectedPrefix = `${userId}/${conv.id}.`;
    const path = conv.recording_url;
    if (
      !path.startsWith(expectedPrefix) ||
      path.includes("..") ||
      !/^[a-z0-9]{1,8}$/i.test(path.slice(expectedPrefix.length))
    ) {
      return { url: null as string | null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("call-audio")
      .createSignedUrl(conv.recording_url, 60 * 60);
    return { url: signed?.signedUrl ?? null };
  });
