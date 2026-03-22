import { ComposePanel } from "@/features/inbox/components/compose-panel";
import { InboxDesktopView } from "@/features/inbox/components/inbox-desktop-view";
import { InboxMobileView } from "@/features/inbox/components/inbox-mobile-view";
import {
  useRegisterEmailCommandHandler,
  type EmailCommand,
} from "@/features/inbox/hooks/use-email-command-state";
import { EmailProvider, useEmail } from "@/features/inbox/context/email-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSetPageContext } from "@/hooks/use-page-context";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

const emailsRoute = getRouteApi("/_dashboard/inbox/$id/");

function InboxContent() {
  const navigate = emailsRoute.useNavigate();
  const search = emailsRoute.useSearch();
  const isMobile = useIsMobile();

  const {
    mailboxId,
    selectedEmail,
    selection,
    forwardOpen,
    composeInitial,
    closeForward,
  } = useEmail();

  const isComposing = search.compose === true;

  useSetPageContext(
    useMemo(
      () => ({
        route: "inbox",
        entity: selectedEmail
          ? {
              type: "email" as const,
              id: selectedEmail.id,
              subject: selectedEmail.subject,
              fromName: selectedEmail.fromName,
              fromAddr: selectedEmail.fromAddr,
              threadId: selectedEmail.threadId,
              mailboxId: selectedEmail.mailboxId,
            }
          : undefined,
      }),
      [selectedEmail],
    ),
  );

  useRegisterEmailCommandHandler(
    useCallback(
      (command: EmailCommand) => {
        switch (command.type) {
          case "selection-mode":
            selection.setSelectionMode(command.enabled);
            if (!command.enabled) selection.deselectAll();
            break;
          case "select-all-visible":
            selection.selectAll();
            break;
          case "clear-selection":
            selection.clearSelection();
            break;
        }
      },
      [selection],
    ),
  );

  return (
    <>
      {isMobile ? <InboxMobileView /> : <InboxDesktopView />}
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
