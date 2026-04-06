import { openCompose } from "@/features/inbox/components/compose-events";
import { issueEmailCommand } from "@/features/inbox/hooks/use-email-command-state";
import { getShortcutsByScope } from "@/lib/hotkeys/shortcuts";
import { useShortcuts } from "@/lib/hotkeys/use-shortcuts";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";

const inboxShortcuts = getShortcutsByScope("inbox");

export function useInboxHotkeys() {
  const navigate = useNavigate();
  const router = useRouter();
  const activeMailboxParam = router.state.matches.find(
    (match) => match.routeId === "/_dashboard/$mailboxId",
  )?.params.mailboxId;
  const activeMailboxId = activeMailboxParam != null
    ? Number(activeMailboxParam)
    : null;

  const handlers = useMemo(
    () => ({
      compose: () => {
        if (!activeMailboxId) return;
        const onInbox = router.state.matches.some(
          (match) => match.routeId === "/_dashboard/$mailboxId/inbox/",
        );
        if (!onInbox) {
          void navigate({
            to: "/$mailboxId/inbox",
            params: { mailboxId: activeMailboxId },
          });
        }
        openCompose({ mailboxId: activeMailboxId });
      },
      archive: () => issueEmailCommand({ type: "archive" }),
      trash: () => issueEmailCommand({ type: "trash" }),
      navigateNext: () => issueEmailCommand({ type: "navigate-next" }),
      navigatePrev: () => issueEmailCommand({ type: "navigate-prev" }),
      open: () => issueEmailCommand({ type: "open-first-visible" }),
      escape: () => issueEmailCommand({ type: "escape" }),
      reply: () => issueEmailCommand({ type: "reply" }),
      forward: () => issueEmailCommand({ type: "forward" }),
      toggleRead: () => issueEmailCommand({ type: "toggle-read" }),
      toggleStar: () => issueEmailCommand({ type: "toggle-star" }),
    }),
    [navigate, activeMailboxId],
  );

  useShortcuts(inboxShortcuts, handlers, { scope: "inbox" });
}
