import NewEmailPage from "@/features/email/inbox/pages/new-email-page";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const newComposeSearchSchema = z.object({
  composeKey: z.string().min(1).optional(),
});

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/new")({
  validateSearch: newComposeSearchSchema,
  component: NewEmailPage,
});
