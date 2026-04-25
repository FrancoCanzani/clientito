import { InboxSidebarShell } from "@/components/inbox-sidebar-shell";
import { LoadingEmailsPending } from "@/components/loading-emails-pending";
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
  pendingComponent: LoadingEmailsPending,
  pendingMs: 120,
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
  },
  component: () => (
    <InboxSidebarShell>
      <Outlet />
    </InboxSidebarShell>
  ),
});
