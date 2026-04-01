import { ComposePanel } from "@/features/inbox/components/compose-panel";
import { EmailList } from "@/features/inbox/components/email-list";
import {
  EmailProvider,
  useEmail,
} from "@/features/inbox/context/email-context";
import {
  useRegisterEmailCommandHandler,
  type EmailCommand,
} from "@/features/inbox/hooks/use-email-command-state";
import { useSetPageContext } from "@/hooks/use-page-context";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

const emailsRoute = getRouteApi("/_dashboard/inbox/$id/");

function InboxContent() {
  const navigate = emailsRoute.useNavigate();
  const search = emailsRoute.useSearch();

  const {
    mailboxId,
    executeEmailAction,
    forwardOpen,
    composeInitial,
    closeForward,
  } = useEmail();

  const isComposing = search.compose === true;
  const pageContext = useMemo(() => ({ route: "inbox" }), []);

  useSetPageContext(pageContext);

  useRegisterEmailCommandHandler(
    useCallback(
      (command: EmailCommand) => {
        switch (command.type) {
          case "archive":
            executeEmailAction("archive");
            break;
          case "trash":
            executeEmailAction("trash");
            break;
        }
      },
      [executeEmailAction],
    ),
  );

  return (
    <>
      <EmailList />
      <ComposePanel
        open={isComposing || forwardOpen}
        initial={
          forwardOpen
            ? composeInitial
            : isComposing && mailboxId != null
              ? { mailboxId }
              : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            closeForward();
            if (isComposing) {
              navigate({
                search: (prev) => ({ ...prev, compose: undefined }),
                replace: true,
              });
            }
          }
        }}
      />
    </>
  );
}

export default function EmailInboxPage() {
  return (
    <EmailProvider>
      <InboxContent />
    </EmailProvider>
  );
}
