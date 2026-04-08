import GetStartedPage from "@/features/onboarding/pages/get-started-page";
import { getDashboardGate } from "@/features/onboarding/dashboard-gate";
import { fetchAccounts } from "@/hooks/use-mailboxes";
import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/get-started")({
  beforeLoad: async () => {
    const gate = await getDashboardGate();

    if (!gate.hasUser) {
      throw redirect({ to: "/login" });
    }

    if (!gate.needsOnboarding) {
      const accountsData = await fetchAccounts();
      const mailboxId = getPreferredMailboxId(accountsData.accounts);
      if (!mailboxId) {
        throw redirect({ to: "/login" });
      }
      throw redirect({
        to: "/$mailboxId/inbox",
        params: { mailboxId },
      });
    }
  },
  component: GetStartedPage,
});
