import { EmailList } from "@/features/inbox/components/email-list";
import { useEmailData } from "@/features/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/inbox/hooks/use-email-inbox-actions";
import { useSetPageContext } from "@/hooks/use-page-context";
import { useHotkeyScope } from "@/lib/hotkeys/use-scope";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/sent");

export default function SentPage() {
  const { mailboxId } = route.useParams();
  const initialPage = route.useLoaderData();
  const emailData = useEmailData({ view: "sent", mailboxId, initialPage });
  const { openEmail, executeEmailAction } = useEmailInboxActions({ view: "sent", mailboxId });
  useHotkeyScope("inbox");
  useSetPageContext(useMemo(() => ({ route: "inbox" }), []));
  return (
    <EmailList emailData={emailData} onOpen={openEmail} onAction={executeEmailAction} />
  );
}
