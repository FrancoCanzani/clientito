import MailboxPage from "@/features/settings/pages/mailbox-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/settings/mailbox")({
  component: MailboxPage,
});
