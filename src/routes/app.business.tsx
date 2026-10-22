import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFunnel } from "@/components/app-funnel/funnel-context";

export const Route = createFileRoute("/app/business")({
  head: () => ({
    meta: [
      { title: "Your business — Ask Janice app" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BusinessStep,
});

function BusinessStep() {
  const { data, update } = useFunnel();
  const navigate = useNavigate();
  const canContinue = data.businessName.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col">
      <h1 className="font-display text-2xl font-bold text-foreground">
        What's your business?
      </h1>
      <p className="mt-2 text-muted-foreground">
        Janice introduces herself with your business name on every call.
      </p>

      <div className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="business-name">Business name</Label>
          <Input
            id="business-name"
            placeholder="e.g. Bright Smile Dental"
            value={data.businessName}
            onChange={(e) => update({ businessName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website (optional)</Label>
          <Input
            id="website"
            type="url"
            placeholder="https://yourbusiness.com"
            value={data.website}
            onChange={(e) => update({ website: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-6 flex gap-3 rounded-xl border border-border bg-gold-soft p-4">
        <Sparkles className="h-5 w-5 shrink-0 text-gold-foreground" />
        <p className="text-sm text-gold-foreground">
          Add your website and Janice will learn your services, hours, and
          pricing automatically — you can review everything before she goes
          live.
        </p>
      </div>

      <div className="mt-auto pt-8">
        <Button
          size="lg"
          className="w-full"
          disabled={!canContinue}
          onClick={() => navigate({ to: "/app/personalize" })}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
