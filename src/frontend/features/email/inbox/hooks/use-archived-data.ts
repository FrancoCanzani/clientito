import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import type { EmailListPage } from "@/features/email/mail/types";

export function useArchivedData({
  mailboxId,
  initialPage,
}: {
  mailboxId: number;
  initialPage?: EmailListPage;
}) {
  return useMailViewData({ view: "archived", mailboxId, initialPage });
}
