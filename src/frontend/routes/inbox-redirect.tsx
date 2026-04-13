import { startFullSync } from "@/features/onboarding/mutations";
import { fetchSyncStatus } from "@/features/onboarding/queries";
import { fetchAccounts } from "@/hooks/use-mailboxes";
import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/inbox-redirect")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async () => {
    const accountsData = await fetchAccounts();
    const mailboxId = getPreferredMailboxId(accountsData.accounts);

    if (!mailboxId) {
      throw redirect({ to: "/login" });
    }

    const status = await fetchSyncStatus();
    if (
      status.state === "ready_to_sync" ||
      status.state === "needs_mailbox_connect"
    ) {
      startFullSync(6, mailboxId).catch(console.error);
    }

    throw redirect({
      to: "/$mailboxId/inbox",
      params: { mailboxId: String(mailboxId) },
    } as any);
  },
});
