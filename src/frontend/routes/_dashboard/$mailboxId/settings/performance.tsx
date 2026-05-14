import PerformancePage from "@/features/settings/pages/performance-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/settings/performance",
)({
  component: PerformancePage,
});
