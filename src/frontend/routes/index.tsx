import LandingPage from "@/components/landing-page";
import { getPreferredMailboxId } from "@/features/email/mail/utils/mailbox";
import { accountsQueryOptions } from "@/hooks/use-mailboxes";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
 beforeLoad: async ({ context }) => {
 const session = await authClient.getSession();
 if (!session.data?.user) return;

 const { accounts } =
 await context.queryClient.ensureQueryData(accountsQueryOptions);
 const preferredMailboxId = getPreferredMailboxId(accounts);
 if (!preferredMailboxId) return;

 throw redirect({
 to: "/$mailboxId/inbox",
 params: { mailboxId: preferredMailboxId },
 });
 },
 component: LandingPage,
});
