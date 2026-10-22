import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFunnel } from "@/components/app-funnel/funnel-context";

export const Route = createFileRoute("/app/personalize")({
  head: () => ({
    meta: [
      { title: "Personalize Janice — Ask Janice app" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PersonalizeStep,
});

const VOICES = [
  { id: "janice", name: "Janice", desc: "Warm and friendly" },
  { id: "claire", name: "Claire", desc: "Calm and professional" },
  { id: "marcus", name: "Marcus", desc: "Confident and clear" },
];

function PersonalizeStep() {
  const { data, update } = useFunnel();
  const navigate = useNavigate();
  const business = data.businessName.trim() || "your business";
  const greeting =
    data.greeting ||
    `Thanks for calling ${business}, this is Janice. How can I help you today?`;

  return (
    <div className="flex-1 flex flex-col">
      <h1 className="font-display text-2xl font-bold text-foreground">
        Make Janice yours
      </h1>
      <p className="mt-2 text-muted-foreground">
        This is what Janice knows when she answers. Keep it short — you can
        refine it anytime.
      </p>

      <div className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="services">Services you offer</Label>
          <Textarea
            id="services"
            rows={2}
            placeholder="e.g. Cleanings, fillings, whitening, emergency dental"
            value={data.services}
            onChange={(e) => update({ services: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hours">Business hours</Label>
          <Input
            id="hours"
            placeholder="e.g. Mon–Fri 9am–5pm, Sat 10am–2pm"
            value={data.hours}
            onChange={(e) => update({ hours: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="faqs">Common questions & answers</Label>
          <Textarea
            id="faqs"
            rows={3}
            placeholder={"e.g. Do you take walk-ins? Yes, weekdays before 3pm.\nWhere do I park? Free lot behind the building."}
            value={data.faqs}
            onChange={(e) => update({ faqs: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="greeting">Greeting</Label>
          <Textarea
            id="greeting"
            rows={2}
            value={greeting}
            onChange={(e) => update({ greeting: e.target.value })}
          />
        </div>
      </div>

      <p className="mt-6 mb-2 text-sm font-medium text-foreground">Voice</p>
      <div className="grid grid-cols-3 gap-2">
        {VOICES.map((v) => {
          const selected = data.voice === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => update({ voice: v.id })}
              className={`relative rounded-xl border p-3 text-left transition-colors ${
                selected
                  ? "border-primary bg-gold-soft"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              {selected && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </span>
              )}
              <span className="block font-semibold text-foreground">{v.name}</span>
              <span className="block text-xs text-muted-foreground">{v.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-8">
        <Button
          size="lg"
          className="w-full"
          onClick={() => navigate({ to: "/app/connect" })}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
