import EmailInboxPage from "@/features/inbox/pages/email-inbox-page";
import { fetchEmails } from "@/features/inbox/queries";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const emailSearchIdSchema = z
  .union([z.string(), z.number()])
  .transform((value) => {
    const normalized = String(value)
      .replace(/^"+|"+$/g, "")
      .trim();
    return normalized === "" ? undefined : normalized;
  })
  .optional();

const emailsSearchSchema = z.object({
  id: emailSearchIdSchema,
  emailId: emailSearchIdSchema,
  threadId: z.string().trim().optional(),
  compose: z.coerce.boolean().optional(),
  view: z
    .enum(["inbox", "sent", "spam", "trash", "snoozed", "archived", "starred"])
    .optional(),
});

export const Route = createFileRoute("/_dashboard/inbox/")({
  validateSearch: emailsSearchSchema,
  loaderDeps: ({ search }) => ({
    view: search.view ?? "inbox",
  }),
  loader: async ({ deps }) => {
    const initialEmails = await fetchEmails({
      view: deps.view,
      limit: 60,
      offset: 0,
    });
    return { initialEmails };
  },
  component: EmailInboxPage,
});
