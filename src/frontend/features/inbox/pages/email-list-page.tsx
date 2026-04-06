import { EmailList } from "@/features/inbox/components/email-list";
import { useEmailData } from "@/features/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/inbox/hooks/use-email-inbox-actions";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
import { useSetPageContext } from "@/hooks/use-page-context";
import { useHotkeyScope } from "@/lib/hotkeys/use-scope";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");
const folderRoute = getRouteApi("/_dashboard/$mailboxId/inbox/folders/$folder");

export function EmailListPage({
  view,
}: {
  view: EmailView;
}) {
  const { mailboxId } = mailboxRoute.useParams();
  const emailData = useEmailData({ view, mailboxId });
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view,
    mailboxId,
  });

  useHotkeyScope("inbox");
  useSetPageContext(useMemo(() => ({ route: "inbox" }), []));

  return (
    <EmailList
      emailData={emailData}
      onOpen={openEmail}
      onAction={executeEmailAction}
    />
  );
}

export function EmailFolderPage() {
  const { folder } = folderRoute.useLoaderData();
  return <EmailListPage view={folder} />;
}
