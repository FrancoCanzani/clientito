import TriagePage from "@/features/email/triage/pages/triage-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/triage")({
  component: TriagePage,
});
