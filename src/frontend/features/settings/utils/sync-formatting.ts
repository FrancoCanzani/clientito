import type { MailboxAccount } from "@/hooks/use-mailboxes";
import { formatDistanceToNow } from "date-fns";

function formatRelativeTime(value: number | null): string | null {
  if (!value) return null;
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function humanizeSyncError(error: string | null): string | null {
  if (!error) return null;

  const normalized = error.toLowerCase();

  if (
    normalized.includes("history is too old") ||
    normalized.includes("full sync again") ||
    normalized.includes("full sync first")
  ) {
    return "Petit needs a fresh full import to catch up with Gmail.";
  }

  if (
    normalized.includes("invalid_grant") ||
    normalized.includes("reconnect")
  ) {
    return "Google needs you to reconnect this account.";
  }

  return error;
}

export function getMailboxStatusCopy(account: MailboxAccount) {
  const lastSuccess = formatRelativeTime(account.lastSync);
  const humanizedError = humanizeSyncError(account.error);

  if (account.syncState === "needs_reconnect") {
    return {
      badge: "Reconnect Gmail",
      badgeTone: "bg-amber-500",
      detail:
        "Google access expired. Reconnect this account to resume email sync.",
      reimportHint:
        "Run a fresh full import after reconnecting if this mailbox still looks incomplete.",
    };
  }

  if (account.syncState === "error") {
    const detail = [
      humanizedError,
      lastSuccess ? `Last completed sync was ${lastSuccess}.` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return {
      badge: account.hasSynced
        ? "Sync needs attention"
        : "Import needs attention",
      badgeTone: "bg-amber-500",
      detail,
      reimportHint: "Run a fresh full import using the history window above.",
    };
  }

  if (!account.hasSynced) {
    return {
      badge: "Ready to import",
      badgeTone: "bg-zinc-400",
      detail:
        "Your account is connected. Open the inbox to start the first import.",
      reimportHint: "Run a fresh full import using the history window above.",
    };
  }

  return {
    badge: "Up to date",
    badgeTone: "bg-green-500",
    detail: lastSuccess
      ? `Last completed sync was ${lastSuccess}.`
      : "Your mailbox is connected and syncing normally.",
    reimportHint: "Run a fresh full import using the history window above.",
  };
}
