import { useInboxData } from "@/features/email/inbox/hooks/use-inbox-data";
import { fetchLocalViewPage } from "@/features/email/mail/data/view-pages";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type { EmailListPage } from "@/features/email/mail/types";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const PRELOAD_DELAY_MS = 1_000;
const PRELOAD_VIEWS = [
  "inbox",
  "sent",
  "archived",
  "starred",
  "spam",
  "trash",
] as const;

export function useViewPreload() {
  const queryClient = useQueryClient();
  const { mailboxId: rawMailboxId } = mailboxRoute.useParams();
  const mailboxId = Number(rawMailboxId);
  const inboxData = useInboxData({ mailboxId, view: "important" });
  const inboxReady = inboxData.hasEmails && !inboxData.isLoading;

  useEffect(() => {
    if (!Number.isFinite(mailboxId) || mailboxId <= 0) return;
    if (!inboxReady) return;

    const timer = window.setTimeout(() => {
      for (const view of PRELOAD_VIEWS) {
        const queryKey = emailQueryKeys.list(view, mailboxId);
        if (queryClient.getQueryData(queryKey)) continue;

        void fetchLocalViewPage({ mailboxId, view })
          .then((page) => {
            if (page.emails.length === 0) return;
            queryClient.setQueryData<InfiniteData<EmailListPage>>(queryKey, {
              pages: [page],
              pageParams: [""],
            });
          })
          .catch(() => {});
      }
    }, PRELOAD_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [mailboxId, inboxReady, queryClient]);
}
