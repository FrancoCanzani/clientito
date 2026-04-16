import {
  getLocalSyncSnapshot,
  subscribeLocalSync,
  type LocalSyncSnapshot,
} from "@/db/sync";
import { useSyncExternalStore } from "react";

export function useLocalSyncSnapshot(
  userId: string | null | undefined,
  mailboxId: number | null | undefined,
): LocalSyncSnapshot {
  return useSyncExternalStore(
    subscribeLocalSync,
    () => getLocalSyncSnapshot(userId, mailboxId),
    () => getLocalSyncSnapshot(userId, mailboxId),
  );
}
