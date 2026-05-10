import { Error as RouteError } from "@/components/error";
import InboxEmailPage from "@/features/email/inbox/pages/inbox-email-page";
import { parseEmailIdParam } from "@/features/email/mail/views";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/email/$emailId",
)({
  params: {
    parse: (raw) => ({ emailId: parseEmailIdParam(raw.emailId) }),
  },
  errorComponent: RouteError,
  component: InboxEmailPage,
});
