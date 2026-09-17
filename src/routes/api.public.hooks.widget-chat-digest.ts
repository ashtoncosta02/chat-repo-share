import { createFileRoute } from "@tanstack/react-router";

/**
 * Manual trigger for the website-chat transcript sweep.
 *
 * The sweep normally runs off live widget chat traffic and the existing
 * missed-calls cron job; this endpoint stays available for manual replays.
 */
export const Route = createFileRoute("/api/public/hooks/widget-chat-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeCronRequest } = await import("@/server/cron-auth.server");
        const denied = await authorizeCronRequest(request);
        if (denied) return denied;

        const { sweepIdleWidgetChats } = await import("@/server/widget-chat-digest.server");
        const result = await sweepIdleWidgetChats();

        if (result.error) {
          return new Response(JSON.stringify({ success: false, error: result.error }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, notified: result.notified }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
