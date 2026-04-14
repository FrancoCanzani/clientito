import LandingPage from "@/components/landing-page";
import { getDashboardGate } from "@/features/onboarding/dashboard-gate";
import { fetchAccounts } from "@/hooks/use-mailboxes";
import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const gate = await getDashboardGate();
    if (!gate.hasUser) return;

    try {
      const { accounts } = await fetchAccounts();
      const mailboxId = getPreferredMailboxId(accounts);
      if (mailboxId) {
        throw redirect({
          to: "/$mailboxId/inbox",
          params: { mailboxId: String(mailboxId) } as never,
        });
      }
    } catch (e) {
      if (e instanceof Response || (e && typeof e === "object" && "to" in e)) throw e;
    }
  },
  component: LandingPage,
});
