import { EmailList } from "@/features/email/inbox/components/list/email-list";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { useSetPageContext } from "@/hooks/use-page-context";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/$folder/");

export default function FolderPage() {
  const { mailboxId, folder } = route.useParams();
  const { initialPage } = route.useLoaderData();
  const emailData = useEmailData({ view: folder, mailboxId, initialPage });
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: folder,
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
