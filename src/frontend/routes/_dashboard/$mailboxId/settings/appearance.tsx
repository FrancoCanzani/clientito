import AppearancePage from "@/features/settings/pages/appearance-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/settings/appearance",
)({
  component: AppearancePage,
});
