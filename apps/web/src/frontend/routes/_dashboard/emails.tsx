import EmailInboxPage from "@/features/emails/pages/email-inbox-page";
import { fetchEmails } from "@/features/emails/queries/fetch-emails";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const emailsSearchSchema = z.object({
  emailId: z.string().trim().optional(),
  threadId: z.string().trim().optional(),
  compose: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_dashboard/emails")({
  validateSearch: emailsSearchSchema,
  loader: async () => {
    const initialEmails = await fetchEmails({
      limit: 100,
      offset: 0,
    });
    return { initialEmails };
  },
  component: EmailInboxPage,
});
