import DangerPage from "@/features/settings/pages/danger-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/settings/danger")({
  component: DangerPage,
});
