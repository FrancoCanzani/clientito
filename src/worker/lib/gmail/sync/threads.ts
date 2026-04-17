import { fetchThreadsBatch } from "../client";
import { parseGmailMessage, type ParsedEmail } from "./parse";

const THREAD_FETCH_CONCURRENCY = 5;

export async function fetchThreadsAndParse(
  accessToken: string,
  threadIds: string[],
  cutoffAt: number | null,
): Promise<ParsedEmail[]> {
  if (threadIds.length === 0) return [];

  const threads = await fetchThreadsBatch(
    accessToken,
    threadIds,
    "full",
    THREAD_FETCH_CONCURRENCY,
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
