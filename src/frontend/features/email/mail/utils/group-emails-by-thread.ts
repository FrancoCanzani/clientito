import type { EmailListItem } from "../types";

export type ThreadGroup = {
  representative: EmailListItem;
  threadCount: number;
  threadId: string | null;
  emails: EmailListItem[];
};

export function groupEmailsByThread(emails: EmailListItem[]): ThreadGroup[] {
  const standaloneGroups: ThreadGroup[] = [];
  const threadGroups = new Map<string, EmailListItem[]>();

  for (const email of emails) {
    if (!email.threadId) {
      standaloneGroups.push({
        representative: email,
        threadCount: 1,
        threadId: null,
        emails: [email],
      });
      continue;
    }

    const group = threadGroups.get(email.threadId);
    if (group) {
      group.push(email);
    } else {
      threadGroups.set(email.threadId, [email]);
    }
  }

  const groupedThreads = Array.from(threadGroups.entries()).map(
    ([threadId, threadEmails]) => {
      const emailsByMostRecent = [...threadEmails].sort((left, right) => {
        if (right.date !== left.date) {
          return right.date - left.date;
        }

        return right.createdAt - left.createdAt;
      });

      return {
        representative: emailsByMostRecent[0]!,
        threadCount: emailsByMostRecent[0]?.threadCount ?? emailsByMostRecent.length,
        threadId,
        emails: emailsByMostRecent,
      };
    },
  );

  return [...standaloneGroups, ...groupedThreads].sort((left, right) => {
    if (right.representative.date !== left.representative.date) {
      return right.representative.date - left.representative.date;
    }

    return right.representative.createdAt - left.representative.createdAt;
  });
}
