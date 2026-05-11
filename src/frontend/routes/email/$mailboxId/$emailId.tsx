import { Error as RouteError } from "@/components/error";
import FullEmailPage from "@/features/email/full-view/full-email-page";
import { parseEmailIdParam } from "@/features/email/mail/views";
import { getDashboardGate } from "@/features/onboarding/dashboard-gate";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/email/$mailboxId/$emailId")({
  beforeLoad: async () => {
    const gate = await getDashboardGate();
    if (!gate.hasUser) {
      throw redirect({ to: "/login" });
    }
  },
  params: {
    parse: (raw) => ({
      mailboxId: Number(raw.mailboxId),
      emailId: parseEmailIdParam(raw.emailId),
    }),
    stringify: (params) => ({
      mailboxId: String(params.mailboxId),
      emailId: String(params.emailId),
    }),
  },
  errorComponent: RouteError,
  component: FullEmailPage,
});
