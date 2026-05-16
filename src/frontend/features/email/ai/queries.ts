import type { EmailThreadItem } from "@/features/email/mail/shared/types";
import { toAiThreadMessages, type ThreadSummary } from "./types";

export async function fetchThreadSummary(input: {
  mailboxId: number;
  threadId: string;
  messages: EmailThreadItem[];
}): Promise<ThreadSummary> {
  const response = await fetch("/api/ai/thread-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId: input.mailboxId,
      threadId: input.threadId,
      messages: toAiThreadMessages(input.messages),
    }),
  });
  if (!response.ok) throw new Error("Failed to load summary");
  return response.json();
}
