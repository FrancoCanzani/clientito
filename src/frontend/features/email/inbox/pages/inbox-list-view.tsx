import { EmailList } from "@/features/email/inbox/components/email-list";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import type { EmailListResponse } from "@/features/email/inbox/types";
import type { EmailView } from "@/features/email/inbox/utils/inbox-filters";
import { useSetPageContext } from "@/hooks/use-page-context";
import { useMemo } from "react";

export function InboxListView({
  view,
  mailboxId,
  initialPage,
}: {
  view: EmailView;
  mailboxId: number;
  initialPage: EmailListResponse;
}) {
  const emailData = useEmailData({ view, mailboxId, initialPage });
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view,
    mailboxId,
  });

  useSetPageContext(useMemo(() => ({ route: "inbox" }), []));

  return (
    <EmailList
      emailData={emailData}
      onOpen={openEmail}
      onAction={executeEmailAction}
    />
  );
}
