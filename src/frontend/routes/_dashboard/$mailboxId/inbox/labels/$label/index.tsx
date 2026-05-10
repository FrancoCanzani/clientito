import { Error as RouteError } from "@/components/error";
import LabelPage from "@/features/email/inbox/pages/label-page";
import { parseInboxLabelParam } from "@/features/email/mail/views";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const labelPageSearchSchema = z.object({
  emailId: z.string().min(1).optional(),
});

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/labels/$label/",
)({
  validateSearch: labelPageSearchSchema,
  params: {
    parse: (raw) => ({ label: parseInboxLabelParam(raw.label) }),
  },
  errorComponent: RouteError,
  component: LabelPage,
});
