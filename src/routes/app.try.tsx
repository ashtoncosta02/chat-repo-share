import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFunnel } from "@/components/app-funnel/funnel-context";

export const Route = createFileRoute("/app/try")({
  head: () => ({
    meta: [
      { title: "Try Janice — Ask Janice app" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TryStep,
});

interface DemoLine {
  speaker: "janice" | "caller";
  text: string;
}

function TryStep() {
  const { data } = useFunnel();
  const navigate = useNavigate();
  const business = data.businessName.trim() || "your business";

  const script: DemoLine[] = [
    {
      speaker: "janice",
      text:
        data.greeting.trim() ||
        `Thanks for calling ${business}, this is Janice. How can I help you today?`,
    },
    { speaker: "caller", text: "Hi, do you have any openings this week?" },
    {
      speaker: "janice",
      text: "We do! I have Thursday at 10:30am or Friday at 2:00pm available. Which works better for you?",
    },
    { speaker: "caller", text: "Thursday at 10:30 works." },
    {
      speaker: "janice",
      text: "You're all set for Thursday at 10:30am. Can I get your name and a good phone number for the booking?",
    },
  ];

  const [visible, setVisible] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started || visible >= script.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), 1600);
    return () => clearTimeout(t);
  }, [started, visible, script.length]);

  const done = visible >= script.length;

  return (
    <div className="flex-1 flex flex-col">
      <h1 className="font-display text-2xl font-bold text-foreground">
        Hear Janice in action
      </h1>
      <p className="mt-2 text-muted-foreground">
        This is how a call to {business} will sound, using what you just set
        up.
      </p>

      <div className="mt-6 flex-1 space-y-3">
        {!started ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary">
              <PhoneCall className="h-6 w-6 text-primary-foreground" />
            </span>
            <Button size="lg" onClick={() => { setStarted(true); setVisible(1); }}>
              Play demo call
            </Button>
          </div>
        ) : (
          script.slice(0, visible).map((line, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                line.speaker === "janice"
                  ? "bg-gold-soft text-gold-foreground rounded-bl-sm"
                  : "ml-auto bg-muted text-foreground rounded-br-sm"
              }`}
            >
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-70">
                {line.speaker === "janice" ? "Janice" : "Caller"}
              </span>
              {line.text}
            </div>
          ))
        )}
      </div>

      <div className="mt-auto pt-6 space-y-2">
        {started && !done && (
          <p className="text-center text-sm text-muted-foreground">
            Call in progress…
          </p>
        )}
        {done && (
          <p className="text-center text-sm font-medium text-foreground">
            Appointment booked — and you'd already have the lead in your inbox.
          </p>
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={!done}
          onClick={() => navigate({ to: "/app/activate" })}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
