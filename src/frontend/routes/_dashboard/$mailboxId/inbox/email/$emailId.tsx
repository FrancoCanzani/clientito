import { Error as RouteError } from "@/components/error";
import InboxEmailPage from "@/features/email/inbox/pages/inbox-email-page";
import { parseEmailIdParam } from "@/features/email/inbox/utils/inbox-filters";
import {
  createEmailDetailLoader,
  emailDetailRouteOptions,
} from "@/lib/email-detail-loader";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/email/$emailId",
)({
  params: {
    parse: (raw) => ({ emailId: parseEmailIdParam(raw.emailId) }),
  },
  skipRouteOnParseError: { params: true },
  loader: createEmailDetailLoader("inbox"),
  ...emailDetailRouteOptions,
  errorComponent: RouteError,
  component: InboxEmailPage,
});
