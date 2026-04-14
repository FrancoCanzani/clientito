import { EmailList } from "@/features/email/inbox/components/list/email-list";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_dashboard/$mailboxId/$folder/");

export default function FolderPage() {
  const { mailboxId, folder } = route.useParams();
  const emailData = useEmailData({ view: folder, mailboxId });
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: folder,
    mailboxId,
  });

  return (
    <EmailList
      emailData={emailData}
      onOpen={openEmail}
      onAction={executeEmailAction}
    />
  );
}
