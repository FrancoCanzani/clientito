import { ComposePanel } from "@/features/inbox/components/compose-panel";
import { EmailList } from "@/features/inbox/components/email-list";
import {
  EmailProvider,
  useEmail,
} from "@/features/inbox/context/email-context";
import { useHotkeyScope } from "@/lib/hotkeys/use-scope";
import { useSetPageContext } from "@/hooks/use-page-context";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";

const emailsRoute = getRouteApi("/_dashboard/inbox/$id/");

function InboxContent() {
  useHotkeyScope("inbox");
  const navigate = emailsRoute.useNavigate();
  const search = emailsRoute.useSearch();

  const { mailboxId, forwardOpen, composeInitial, closeForward } = useEmail();

  const isComposing = search.compose === true;

  useSetPageContext(useMemo(() => ({ route: "inbox" }), []));

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
