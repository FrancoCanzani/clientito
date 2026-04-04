import type { SyncQueueMessage } from "./queue";

declare global {
  interface Env {
    SYNC_QUEUE: Queue<SyncQueueMessage>;
  }
}
