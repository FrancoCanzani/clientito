import { fetchAccounts } from "@/hooks/use-mailboxes";
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
  loader: async ({ params }) => {
    const accountsData = await fetchAccounts();
    const accounts = accountsData.accounts.filter(
      (account): account is typeof account & { mailboxId: number } =>
        account.mailboxId != null,
    );

    if (accounts.length === 0) {
      throw redirect({ to: "/get-started" });
    }

    if (!accounts.some((account) => account.mailboxId === params.mailboxId)) {
      throw notFound();
    }
  },
  component: () => <Outlet />,
});
