import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import type { EmailListPage } from "@/features/email/inbox/types";

export function useArchivedData({
  mailboxId,
  initialPage,
}: {
  mailboxId: number;
  initialPage?: EmailListPage;
}) {
  return useEmailData({ view: "archived", mailboxId, initialPage });
}
