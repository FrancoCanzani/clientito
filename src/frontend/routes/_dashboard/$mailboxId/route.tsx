import { InboxSidebarShell } from "@/features/email/inbox/components/shell/inbox-sidebar-shell";
import { startFullSync } from "@/features/onboarding/mutations";
import { fetchSyncStatus } from "@/features/onboarding/queries";
import { accountsQueryOptions } from "@/hooks/use-mailboxes";
import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/_dashboard/$mailboxId")({
  parseParams: (raw) => ({
    mailboxId: z.coerce.number().int().positive().parse(raw.mailboxId),
  }),
  stringifyParams: ({ mailboxId }) => ({ mailboxId: String(mailboxId) }),
  loader: async ({ context, params }) => {
    const accountsData =
      await context.queryClient.ensureQueryData(accountsQueryOptions);
    const accounts = accountsData.accounts.filter(
      (account): account is typeof account & { mailboxId: number } =>
        account.mailboxId != null,
    );

    if (accounts.length === 0) {
      throw redirect({ to: "/login" });
    }

    if (!accounts.some((account) => account.mailboxId === params.mailboxId)) {
      throw notFound();
    }

    // Trigger initial full sync if the mailbox hasn't synced yet
    fetchSyncStatus().then((status) => {
      if (
        status.state === "ready_to_sync" ||
        status.state === "needs_mailbox_connect"
      ) {
        startFullSync(6, params.mailboxId).catch(() => {});
      }
    });
  },
  component: () => (
    <InboxSidebarShell>
      <Outlet />
    </InboxSidebarShell>
  ),
});
