import { getShortcutsByScope } from "@/config/shortcuts";
import { useEmailCommandActions } from "@/features/inbox/hooks/use-email-command-state";
import { useShortcuts } from "@/lib/hotkeys";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";

function getActiveInboxId(pathname: string): string {
  const match = pathname.match(/^\/inbox\/([^/]+)/);
  return match?.[1] ?? "all";
}

const inboxShortcuts = getShortcutsByScope("inbox");

export function InboxHotkeys() {
  const navigate = useNavigate();
  const router = useRouter();
  const issueEmailCommand = useEmailCommandActions();
  const activeInboxId = getActiveInboxId(
    router.state.location.pathname,
  );

  const handlers = useMemo(
    () => ({
      compose: () =>
        navigate({
          to: "/inbox/$id",
          params: { id: activeInboxId },
          search: { compose: true },
        }),
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
    [navigate, activeInboxId, issueEmailCommand],
  );

  useShortcuts(inboxShortcuts, handlers, { scope: "inbox" });

  return null;
}
