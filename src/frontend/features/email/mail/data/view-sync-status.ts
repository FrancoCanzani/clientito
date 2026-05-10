import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { queryClient } from "@/lib/query-client";
import { alignActiveUser } from "./local-cache";

export type ViewSyncStatus = {
  lastFetchedAt: number | null;
  lastError: string | null;
};

export const EMPTY_VIEW_SYNC_STATUS: ViewSyncStatus = {
  lastFetchedAt: null,
  lastError: null,
};

export function viewSyncMetaKey(mailboxId: number, view: string): string {
  return `viewSyncMeta:${mailboxId}:${view}`;
}

export function parseViewSyncStatus(raw: string | null): ViewSyncStatus {
  if (!raw) return EMPTY_VIEW_SYNC_STATUS;
  try {
    const parsed = JSON.parse(raw) as Partial<ViewSyncStatus>;
    return {
      lastFetchedAt:
        typeof parsed.lastFetchedAt === "number" ? parsed.lastFetchedAt : null,
      lastError: typeof parsed.lastError === "string" ? parsed.lastError : null,
    };
  } catch {
    return EMPTY_VIEW_SYNC_STATUS;
  }
}

export async function setViewSyncStatus(
  mailboxId: number,
  view: string,
  meta: ViewSyncStatus,
): Promise<void> {
  await localDb.setMeta(viewSyncMetaKey(mailboxId, view), JSON.stringify(meta));
  void queryClient.invalidateQueries({
    queryKey: emailQueryKeys.viewSyncMeta(view, mailboxId),
  });
}

export async function fetchViewSyncStatus(params: {
  mailboxId: number;
  view: string;
}): Promise<ViewSyncStatus> {
  const userId = await getCurrentUserId();
  if (!userId) return EMPTY_VIEW_SYNC_STATUS;

  await alignActiveUser(userId);
  return parseViewSyncStatus(
    await localDb.getMeta(viewSyncMetaKey(params.mailboxId, params.view)),
  );
}
