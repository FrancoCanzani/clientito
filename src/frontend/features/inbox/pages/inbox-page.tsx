import { registerOpenComposeListener } from "@/features/inbox/components/compose-events";
import { ComposePanel } from "@/features/inbox/components/compose-panel";
import { EmailList } from "@/features/inbox/components/email-list";
import { useEmailData } from "@/features/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/inbox/hooks/use-email-inbox-actions";
import { useForwardCompose } from "@/features/inbox/hooks/use-forward-compose";
import { useSetPageContext } from "@/hooks/use-page-context";
import { useHotkeyScope } from "@/lib/hotkeys/use-scope";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/");

export default function InboxPage() {
  const { mailboxId } = route.useParams();
  const { view, initialPage } = route.useLoaderData();
  const emailData = useEmailData({ view, mailboxId, initialPage });
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view,
    mailboxId,
  });
  const { forwardOpen, composeInitial, openForward, closeForward } =
    useForwardCompose();

  useHotkeyScope("inbox");
  useSetPageContext(useMemo(() => ({ route: "inbox" }), []));

  useEffect(() => {
    return registerOpenComposeListener(openForward);
  }, [openForward]);

  return (
    <>
      <EmailList
        emailData={emailData}
        onOpen={openEmail}
        onAction={executeEmailAction}
      />
      <ComposePanel
        open={forwardOpen}
        initial={composeInitial}
        onOpenChange={(open) => {
          if (!open) closeForward();
        }}
      />
    </>
  );
}
