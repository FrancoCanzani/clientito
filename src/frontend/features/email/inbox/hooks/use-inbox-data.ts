import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import type { EmailListPage } from "@/features/email/mail/types";

export type InboxDataView = "inbox" | "important";

export function useInboxData({
 mailboxId,
 initialPage,
 view = "important",
}: {
 mailboxId: number;
 initialPage?: EmailListPage;
 view?: InboxDataView;
}) {
 return useMailViewData({ view, mailboxId, initialPage });
}
