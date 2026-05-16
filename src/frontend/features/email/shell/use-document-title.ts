import { fetchViewUnreadCounts } from "@/features/email/mail/shared/data/unread-counts";
import { emailQueryKeys } from "@/features/email/mail/shared/query-keys";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const BASE_DOCUMENT_TITLE = "Duomo";

function formatUnreadCount(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

export function useDocumentTitle() {
  const { mailboxId } = mailboxRoute.useParams();
  const viewCountsQuery = useQuery({
    queryKey: emailQueryKeys.viewCounts(mailboxId),
    queryFn: () => fetchViewUnreadCounts(mailboxId),
    staleTime: 60_000,
  });
  const unread = viewCountsQuery.data?.inbox.messagesUnread ?? 0;

  useEffect(() => {
    document.title =
      unread > 0
        ? `(${formatUnreadCount(unread)}) ${BASE_DOCUMENT_TITLE}`
        : BASE_DOCUMENT_TITLE;
    return () => {
      document.title = BASE_DOCUMENT_TITLE;
    };
  }, [unread]);
}
