import { EmailList } from "@/features/email/inbox/components/email-list";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { useSetPageContext } from "@/hooks/use-page-context";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/labels/$label/");

export default function LabelPage() {
  const { mailboxId, label } = route.useParams();
  const { initialPage } = route.useLoaderData();
  const emailData = useEmailData({ view: label, mailboxId, initialPage });
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: label,
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
