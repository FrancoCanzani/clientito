import type { MailboxAccount } from "@/hooks/use-mailboxes";
import { formatDistanceToNow } from "date-fns";

export function formatImportHistoryHint(
  months: 6 | 12 | null,
  cutoffAt: number | null,
): string {
  if (months === null || cutoffAt === null) {
    return "New imports can include your full Gmail history.";
  }

  const date = new Date(cutoffAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return `New imports currently include mail from ${date} onward (${months === 6 ? "last 6 months" : "last year"}).`;
}

function formatRelativeTime(value: number | null): string | null {
  if (!value) return null;
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function humanizeSyncError(
  error: string | null,
  hasSynced: boolean,
): string | null {
  if (!error) return null;

  const normalized = error.toLowerCase();

  if (normalized.includes("stalled or timed out")) {
    return hasSynced
      ? "The latest sync stopped before finishing."
      : "The first import stopped before finishing.";
  }

  if (
    normalized.includes("history is too old") ||
    normalized.includes("full sync again") ||
    normalized.includes("full sync first")
  ) {
    return "Petit needs a fresh full import to catch up with Gmail.";
  }

  if (normalized.includes("no sync state found")) {
    return "This mailbox has not completed its first import yet.";
  }

  if (normalized.includes("sync already in progress")) {
    return "Another sync is already running for this mailbox.";
  }

  if (
    normalized.includes("invalid_grant") ||
    normalized.includes("reconnect")
  ) {
    return "Google needs you to reconnect this account.";
  }

  return error;
}

function formatSyncProgress(account: MailboxAccount): string {
  if (account.phase === "listing") {
    return "Looking through Gmail to see what needs to be imported.";
  }

  if (
    typeof account.progressCurrent === "number" &&
    typeof account.progressTotal === "number" &&
    account.progressTotal > 0
  ) {
    return `${new Intl.NumberFormat().format(account.progressCurrent)} of ${new Intl.NumberFormat().format(account.progressTotal)} emails imported.`;
  }

  if (typeof account.progressCurrent === "number") {
    return `${new Intl.NumberFormat().format(account.progressCurrent)} emails imported so far.`;
  }

  return "Import in progress.";
}

export function getMailboxStatusCopy(account: MailboxAccount, isBusy: boolean) {
  const lastSuccess = formatRelativeTime(account.lastSync);
  const humanizedError = humanizeSyncError(account.error, account.hasSynced);

  if (account.syncState === "needs_reconnect") {
    return {
      badge: "Reconnect Gmail",
      badgeTone: "bg-amber-500",
      detail: "Google access expired. Reconnect this account to resume email and calendar sync.",
      sectionTitle: "Connection status",
      primaryLabel: "Reconnect Gmail",
      reimportHint: "Run a fresh full import after reconnecting if this mailbox still looks incomplete.",
    };
  }

  if (isBusy) {
    return {
      badge: "Import in progress",
      badgeTone: "bg-sky-500",
      detail: formatSyncProgress(account),
      sectionTitle: "Current import",
      primaryLabel: account.hasSynced ? "Sync now" : "Start import",
      reimportHint: "Run a fresh full import using the history window above.",
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
      badge: account.hasSynced ? "Sync needs attention" : "Import needs attention",
      badgeTone: "bg-amber-500",
      detail,
      sectionTitle: account.hasSynced ? "Latest sync" : "Import status",
      primaryLabel: account.hasSynced ? "Try sync again" : "Start import again",
      reimportHint: "Run a fresh full import using the history window above.",
    };
  }

  if (!account.hasSynced) {
    return {
      badge: "Ready to import",
      badgeTone: "bg-zinc-400",
      detail: "Your account is connected. Start the first import when you're ready.",
      sectionTitle: "Import status",
      primaryLabel: "Start import",
      reimportHint: "Run a fresh full import using the history window above.",
    };
  }

  return {
    badge: "Up to date",
    badgeTone: "bg-green-500",
    detail: lastSuccess
      ? `Last completed sync was ${lastSuccess}.`
      : "Your mailbox is connected and syncing normally.",
    sectionTitle: "Last completed sync",
    primaryLabel: "Sync now",
    reimportHint: "Run a fresh full import using the history window above.",
  };
}
