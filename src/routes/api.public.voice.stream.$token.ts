import { createFileRoute } from "@tanstack/react-router";
import { streamSynthesizedAudio } from "@/server/voice-call-helpers";

export const Route = createFileRoute("/api/public/voice/stream/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => streamSynthesizedAudio(params.token),
    },
  },
});