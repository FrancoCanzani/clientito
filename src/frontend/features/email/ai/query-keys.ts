export const aiQueryKeys = {
  threadSummary: (
    mailboxId: number,
    threadId: string,
    lastMessageId: string,
    messageCount: number,
  ) =>
    [
      "ai-thread-summary",
      mailboxId,
      threadId,
      lastMessageId,
      messageCount,
    ] as const,
  replyDraft: (
    mailboxId: number,
    threadId: string,
    lastMessageId: string,
    messageCount: number,
  ) =>
    [
      "ai-reply-draft",
      mailboxId,
      threadId,
      lastMessageId,
      messageCount,
    ] as const,
};
