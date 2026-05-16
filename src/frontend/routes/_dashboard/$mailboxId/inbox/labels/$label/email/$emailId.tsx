import { Error as RouteError } from "@/components/error";
import LabelEmailPage from "@/features/email/inbox/pages/label-email-page";
import {
  parseEmailIdParam,
  parseInboxLabelParam,
} from "@/features/email/mail/shared/views";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/labels/$label/email/$emailId",
)({
  params: {
    parse: (raw) => ({
      label: parseInboxLabelParam(raw.label),
      emailId: parseEmailIdParam(raw.emailId),
    }),
  },
  errorComponent: RouteError,
  component: LabelEmailPage,
});
