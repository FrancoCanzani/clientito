import type { MailSnoozeTarget } from "@/features/email/mail/hooks/use-mail-actions";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
import { useCallback } from "react";

export function getThreadGroupSnoozeTarget(
  group: ThreadGroup,
  fallbackMailboxId: number,
): MailSnoozeTarget {
  const mailboxId = group.representative.mailboxId ?? fallbackMailboxId;

  if (group.threadId && group.representative.mailboxId) {
    return {
      kind: "thread",
      thread: {
        threadId: group.threadId,
        mailboxId: group.representative.mailboxId,
        labelIds: group.representative.labelIds,
      },
    };
  }

  return {
    kind: "email",
    identifier: {
      id: group.representative.id,
      providerMessageId: group.representative.providerMessageId,
      mailboxId,
      labelIds: group.representative.labelIds,
    },
  };
}

export function useThreadGroupSnooze(
  mailboxId: number,
  snooze: (target: MailSnoozeTarget, timestamp: number | null) => Promise<void>,
) {
  return useCallback(
    (group: ThreadGroup, timestamp: number | null) => {
      void snooze(getThreadGroupSnoozeTarget(group, mailboxId), timestamp);
    },
    [mailboxId, snooze],
  );
}
