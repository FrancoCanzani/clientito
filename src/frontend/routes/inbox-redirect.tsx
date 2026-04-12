import { fetchSyncStatus } from "@/features/onboarding/queries";
import { startFullSync } from "@/features/onboarding/mutations";
import { fetchAccounts } from "@/hooks/use-mailboxes";
import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

export const Route = createFileRoute("/inbox-redirect")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async () => {
    let mailboxId: number | null = null;
    for (let i = 0; i < 15; i++) {
      const accountsData = await fetchAccounts();
      mailboxId = getPreferredMailboxId(accountsData.accounts);
      if (mailboxId) break;

      await fetchSyncStatus();
      await new Promise((r) => setTimeout(r, 1000));
    }

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

    // If already synced, go straight to inbox
    if (status.state === "ready") {
      throw redirect({
        to: "/$mailboxId/inbox",
        params: { mailboxId: String(mailboxId) },
      } as any);
    }

    return { mailboxId };
  },
  component: InboxRedirectPage,
});

function InboxRedirectPage() {
  const { mailboxId } = Route.useLoaderData();
  const navigate = useNavigate();
  const pollingRef = useRef(false);

  useEffect(() => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    let cancelled = false;

    async function pollForEmails() {
      for (let i = 0; i < 120; i++) {
        if (cancelled) return;
        try {
          const res = await fetch(
            `/api/inbox/emails?view=inbox&mailboxId=${mailboxId}&limit=1&offset=0`,
          );
          if (res.ok) {
            const json = await res.json();
            if (json.data?.length > 0) {
              navigate({
                to: "/$mailboxId/inbox",
                params: { mailboxId: String(mailboxId) },
              } as any);
              return;
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 2000));
      }
      // Timeout — redirect anyway
      navigate({
        to: "/$mailboxId/inbox",
        params: { mailboxId: String(mailboxId) },
      } as any);
    }

    pollForEmails();
    return () => { cancelled = true; };
  }, [mailboxId, navigate]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <AnimatePresence>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-sm text-muted-foreground"
        >
          Loading your emails…
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
