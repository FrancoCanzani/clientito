import { type ComposeInitial } from "@/features/inbox/components/compose-email-dialog";
import { ComposePanel } from "@/features/inbox/components/compose-panel";
import { InboxDesktopView } from "@/features/inbox/components/inbox-desktop-view";
import { InboxMobileView } from "@/features/inbox/components/inbox-mobile-view";
import {
  useRegisterEmailCommandHandler,
  type EmailCommand,
} from "@/features/inbox/hooks/use-email-command-state";
import { useEmailData } from "@/features/inbox/hooks/use-email-data";
import { useSelectionStore } from "@/features/inbox/stores/selection-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSetPageContext } from "@/hooks/use-page-context";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

const emailsRoute = getRouteApi("/_dashboard/inbox/$id/");

export default function EmailInboxPage() {
  const navigate = emailsRoute.useNavigate();
  const search = emailsRoute.useSearch();
  const isMobile = useIsMobile();

  const { mailboxId, selectedEmail, displayRows } = useEmailData();
  const selection = useSelectionStore(displayRows);

  const isComposing = search.compose === true;
  const [composeInitial, setComposeInitial] = useState<
    ComposeInitial | undefined
  >();
  const [forwardOpen, setForwardOpen] = useState(false);

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

  const handleForward = useCallback((initial: ComposeInitial) => {
    setComposeInitial(initial);
    setForwardOpen(true);
  }, []);

  return (
    <>
      {isMobile ? (
        <InboxMobileView onForward={handleForward} />
      ) : (
        <InboxDesktopView onForward={handleForward} />
      )}
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
            setForwardOpen(false);
            setComposeInitial(undefined);
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
