import type {
  InboxUnreadCount,
  ViewUnreadCounts,
} from "@/features/email/mail/types";

export async function fetchInboxUnreadCount(
  mailboxId: number,
): Promise<InboxUnreadCount> {
  const params = new URLSearchParams({ mailboxId: String(mailboxId) });
  const response = await fetch(`/api/inbox/unread-count?${params.toString()}`);
  const result = (await response.json().catch(() => null)) as {
    data?: InboxUnreadCount;
    error?: string;
  } | null;

  if (!response.ok || !result?.data) {
    throw new Error(result?.error ?? "Failed to fetch inbox unread count");
  }

  return result.data;
}

export async function fetchViewUnreadCounts(
  mailboxId: number,
): Promise<ViewUnreadCounts> {
  const params = new URLSearchParams({ mailboxId: String(mailboxId) });
  const response = await fetch(`/api/inbox/view-counts?${params.toString()}`);
  const result = (await response.json().catch(() => null)) as {
    data?: ViewUnreadCounts;
    error?: string;
  } | null;

  if (!response.ok || !result?.data) {
    throw new Error(result?.error ?? "Failed to fetch view unread counts");
  }

  return result.data;
}
