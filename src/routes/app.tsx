import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { FunnelProvider } from "@/components/app-funnel/funnel-context";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Get started — Ask Janice app" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppFunnelLayout,
});

const STEPS = [
  { path: "/app", label: "Welcome" },
  { path: "/app/business", label: "Your business" },
  { path: "/app/personalize", label: "Personalize" },
  { path: "/app/connect", label: "Connect" },
  { path: "/app/try", label: "Try Janice" },
  { path: "/app/activate", label: "Activate" },
] as const;

function AppFunnelLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const stepIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.path === location.pathname),
  );
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <FunnelProvider>
      <div className="min-h-svh bg-muted/40 flex justify-center">
        <div className="w-full max-w-md bg-background min-h-svh flex flex-col sm:border-x sm:border-border">
          <header className="sticky top-0 z-10 bg-background/90 backdrop-blur px-5 pt-4 pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  aria-label="Go back"
                  onClick={() => navigate({ to: STEPS[stepIndex - 1].path })}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : (
                <span className="w-5" />
              )}
              <div className="flex-1">
                <Progress value={progress} className="h-1.5" />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {stepIndex + 1} of {STEPS.length}
              </span>
            </div>
            <p className="mt-2 text-center text-xs font-medium text-muted-foreground tracking-wide uppercase">
              {STEPS[stepIndex].label}
            </p>
          </header>
          <main className="flex-1 flex flex-col px-5 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </FunnelProvider>
  );
}
