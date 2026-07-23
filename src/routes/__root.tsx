import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ask Janice — AI Voice Agents for Your Business" },
      {
        name: "description",
        content:
          "A custom AI voice agent trained on your business. Answers calls, captures leads, books appointments, and follows up automatically. 24/7.",
      },
      { name: "author", content: "Ask Janice" },
      { property: "og:title", content: "Ask Janice — AI Voice Agents for Your Business" },
      {
        property: "og:description",
        content:
          "Your business deserves a receptionist that never sleeps. Custom AI voice agents — unlimited calls, lead capture, booking, 24/7.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Ask Janice — AI Voice Agents for Your Business" },
      { name: "description", content: "Ask Janice answers your business calls 24/7, captures leads, and books appointments straight into your calendar — so you never miss a customer again." },
      { property: "og:description", content: "Ask Janice answers your business calls 24/7, captures leads, and books appointments straight into your calendar — so you never miss a customer again." },
      { name: "twitter:description", content: "Ask Janice answers your business calls 24/7, captures leads, and books appointments straight into your calendar — so you never miss a customer again." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/bdf233e4-c52b-4b09-802c-6f9c4dad8519/id-preview-970c1d47--d1e796ad-671c-47e1-843b-cdecc02fe11f.lovable.app-1782442129187.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/bdf233e4-c52b-4b09-802c-6f9c4dad8519/id-preview-970c1d47--d1e796ad-671c-47e1-843b-cdecc02fe11f.lovable.app-1782442129187.png" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/__l5e/assets-v1/568beb77-a6b4-4141-8878-452f170a1f2f/favicon.png",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
