import { useEmailCommandActions } from "@/features/inbox/hooks/use-email-command-state";
import { shouldIgnoreHotkeyTarget } from "@/lib/hotkeys";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate, useRouter } from "@tanstack/react-router";

function getActiveInboxId(pathname: string): string {
  const match = pathname.match(/^\/inbox\/([^/]+)/);
  return match?.[1] ?? "all";
}

export function useAppShortcuts() {
  const navigate = useNavigate();
  const router = useRouter();
  const issueEmailCommand = useEmailCommandActions();

  const pathname = router.state.location.pathname;
  const isInboxRoute = pathname.startsWith("/inbox/");
  const activeInboxId = getActiveInboxId(pathname);

  useHotkey(
    "C",
    (event) => {
      if (!isInboxRoute || shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      navigate({
        to: "/inbox/$id",
        params: { id: activeInboxId },
        search: { compose: true },
      });
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "E",
    (event) => {
      if (!isInboxRoute || shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      issueEmailCommand({ type: "archive" });
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    { key: "#", shift: true, alt: false, ctrl: false, meta: false },
    (event) => {
      if (!isInboxRoute || shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      issueEmailCommand({ type: "trash" });
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "J",
    (event) => {
      if (!isInboxRoute || shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      issueEmailCommand({ type: "navigate-next" });
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "ArrowDown",
    (event) => {
      if (!isInboxRoute || shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      issueEmailCommand({ type: "navigate-next" });
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "K",
    (event) => {
      if (!isInboxRoute || shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      issueEmailCommand({ type: "navigate-prev" });
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "ArrowUp",
    (event) => {
      if (!isInboxRoute || shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      issueEmailCommand({ type: "navigate-prev" });
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "Enter",
    (event) => {
      if (!isInboxRoute || shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      issueEmailCommand({ type: "open-first-visible" });
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "Escape",
    (event) => {
      if (!isInboxRoute || shouldIgnoreHotkeyTarget(event.target)) return;
      event.preventDefault();
      issueEmailCommand({ type: "escape" });
    },
    { preventDefault: false, stopPropagation: false },
  );
}
