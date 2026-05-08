import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import type { EmailListPage } from "@/features/email/mail/types";

export function useInboxData({
 mailboxId,
 initialPage,
}: {
 mailboxId: number;
 initialPage?: EmailListPage;
}) {
 return useMailViewData({ view: "inbox", mailboxId, initialPage });
}
