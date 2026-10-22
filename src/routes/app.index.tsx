import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PhoneCall, CalendarCheck, UserPlus, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentFactoryLogo } from "@/components/AgentFactoryLogo";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Meet Janice — Ask Janice app" },
      {
        name: "description",
        content:
          "Set up Janice, your AI receptionist, in a few minutes. She answers calls, books appointments, and captures leads.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeetJanice,
});

const HIGHLIGHTS = [
  {
    icon: PhoneCall,
    title: "Answers every call, 24/7",
    body: "No more missed calls going to voicemail — or to a competitor.",
  },
  {
    icon: CalendarCheck,
    title: "Books real appointments",
    body: "Janice checks your calendar and books customers into open slots.",
  },
  {
    icon: UserPlus,
    title: "Captures every lead",
    body: "Names, numbers, and what they need — delivered to you after each call.",
  },
];

function MeetJanice() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard/conversations", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex-1 flex flex-col">
      <AgentFactoryLogo imgClassName="h-20 w-auto object-contain" />
      <h1 className="mt-4 text-center font-display text-3xl font-bold text-foreground">
        Meet Janice
      </h1>
      <p className="mt-2 text-center text-muted-foreground">
        Your AI receptionist. She answers your business phone and website chat
        so you never miss a customer again.
      </p>

      <div className="mt-8 space-y-4">
        {HIGHLIGHTS.map((h) => (
          <div key={h.title} className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft">
              <h.icon className="h-5 w-5 text-gold-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{h.title}</p>
              <p className="text-sm text-muted-foreground">{h.body}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
          <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
        </span>
        <span>
          <span className="block font-semibold text-foreground">Hear a sample call</span>
          <span className="block text-sm text-muted-foreground">
            45 seconds — Janice booking an appointment
          </span>
        </span>
      </button>

      <div className="mt-auto pt-8">
        <Button asChild size="lg" className="w-full">
          <Link to="/app/business">Get started</Link>
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Takes about 3 minutes
        </p>
      </div>
    </div>
  );
}
