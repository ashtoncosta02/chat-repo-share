import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Phone, PhoneForwarded, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFunnel } from "@/components/app-funnel/funnel-context";

export const Route = createFileRoute("/app/connect")({
  head: () => ({
    meta: [
      { title: "Connect your phone — Ask Janice app" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConnectStep,
});

function ConnectStep() {
  const { data, update } = useFunnel();
  const navigate = useNavigate();

  const phoneOptions = [
    {
      id: "new" as const,
      icon: Phone,
      title: "Get a Janice number",
      body: "A new local number answered by Janice. Forward your main line to it whenever you like.",
    },
    {
      id: "forward" as const,
      icon: PhoneForwarded,
      title: "Forward my existing number",
      body: "Keep your current number. Forward missed calls to Janice so she only answers when you can't.",
    },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <h1 className="font-display text-2xl font-bold text-foreground">
        Connect your phone
      </h1>
      <p className="mt-2 text-muted-foreground">
        Choose how Janice answers your calls.
      </p>

      <div className="mt-6 space-y-3">
        {phoneOptions.map((opt) => {
          const selected = data.phoneChoice === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => update({ phoneChoice: opt.id })}
              className={`flex w-full gap-3 rounded-xl border p-4 text-left transition-colors ${
                selected
                  ? "border-primary bg-gold-soft"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft">
                <opt.icon className="h-5 w-5 text-gold-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{opt.title}</p>
                <p className="text-sm text-muted-foreground">{opt.body}</p>
              </div>
              {selected && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Calendar <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a calendar and Janice can book real appointments into your
          open slots.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant={data.calendar === "google" ? "default" : "outline"}
            onClick={() =>
              update({ calendar: data.calendar === "google" ? null : "google" })
            }
          >
            Google Calendar
          </Button>
          <Button
            variant={data.calendar === "outlook" ? "default" : "outline"}
            onClick={() =>
              update({ calendar: data.calendar === "outlook" ? null : "outlook" })
            }
          >
            Outlook
          </Button>
        </div>
      </div>

      <div className="mt-auto pt-8 space-y-2">
        <Button
          size="lg"
          className="w-full"
          disabled={!data.phoneChoice}
          onClick={() => navigate({ to: "/app/try" })}
        >
          Continue
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          You can change any of this later.
        </p>
      </div>
    </div>
  );
}
