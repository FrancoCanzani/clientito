import TriagePage from "@/features/email/inbox/pages/triage-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/triage")({
  component: TriagePage,
});
