import FocusPage from "@/features/email/focus/pages/focus-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/focus")({
  component: FocusPage,
});
