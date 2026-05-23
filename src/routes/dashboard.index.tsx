import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsPage } from "./dashboard.analytics";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Dashboard — Agent Factory" }] }),
  component: AnalyticsPage,
});
