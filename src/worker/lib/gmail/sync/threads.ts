import { fetchThreadsBatch } from "../client";
import type { GmailMessageFormat } from "../types";
import { parseGmailMessage, type ParsedEmail } from "./parse";

// 10 × threads.get (10 units each) = 100 units, well under Gmail's 250/sec/user.
const THREAD_FETCH_CONCURRENCY = 10;

export async function fetchThreadsAndParse(
  accessToken: string,
  threadIds: string[],
  cutoffAt: number | null,
  options?: {
    format?: GmailMessageFormat;
    metadataHeaders?: string[];
  },
): Promise<ParsedEmail[]> {
  if (threadIds.length === 0) return [];

  const threads = await fetchThreadsBatch(
    accessToken,
    threadIds,
    options?.format ?? "full",
    THREAD_FETCH_CONCURRENCY,
    options?.metadataHeaders,
  );
  const parsed: ParsedEmail[] = [];

  for (const threadId of threadIds) {
    const thread = threads.get(threadId);
    if (!thread) continue;
    for (const message of thread.messages ?? []) {
      const email = parseGmailMessage(message, { minDateMs: cutoffAt });
      if (email) parsed.push(email);
    }
  }

  return parsed;
}
