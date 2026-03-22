import { emails } from "../../../../db/schema";
import { STANDARD_LABELS } from "../../../../lib/email/types";

type EmailPatchMutation = {
  isRead?: boolean;
  archived?: boolean;
  trashed?: boolean;
  spam?: boolean;
  starred?: boolean;
  snoozedUntil?: number | null;
};

type EmailPatchSource = {
  isRead: boolean;
  labelIds: string[] | null;
  snoozedUntil: number | null;
};

type EmailPatchResult = {
  isRead: boolean;
  labelIds: string[];
  archived: boolean;
  trashed: boolean;
  spam: boolean;
  starred: boolean;
  snoozedUntil: number | null;
  dbUpdates: Partial<typeof emails.$inferInsert>;
  addLabelIds: string[];
  removeLabelIds: string[];
};

function areLabelIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function applyEmailPatch(
  email: EmailPatchSource,
  mutation: EmailPatchMutation,
): EmailPatchResult {
  const currentLabelIds = email.labelIds ?? [];
  const nextLabelIds = new Set(currentLabelIds);
  const addLabelIds = new Set<string>();
  const removeLabelIds = new Set<string>();
  const dbUpdates: Partial<typeof emails.$inferInsert> = {};
  let isRead = email.isRead;
  let snoozedUntil: number | null = email.snoozedUntil ?? null;

  const queueAdd = (labelId: string) => {
    if (nextLabelIds.has(labelId)) {
      return;
    }

    nextLabelIds.add(labelId);
    removeLabelIds.delete(labelId);
    addLabelIds.add(labelId);
  };

  const queueRemove = (labelId: string) => {
    if (!nextLabelIds.has(labelId)) {
      return;
    }

    nextLabelIds.delete(labelId);
    addLabelIds.delete(labelId);
    removeLabelIds.add(labelId);
  };

  if (mutation.isRead !== undefined && mutation.isRead !== email.isRead) {
    isRead = mutation.isRead;
    dbUpdates.isRead = mutation.isRead;
    if (mutation.isRead) {
      queueRemove(STANDARD_LABELS.UNREAD);
    } else {
      queueAdd(STANDARD_LABELS.UNREAD);
    }
  }

  if (mutation.archived !== undefined) {
    if (mutation.archived) {
      queueRemove(STANDARD_LABELS.INBOX);
    } else if (
      !nextLabelIds.has(STANDARD_LABELS.TRASH) &&
      !nextLabelIds.has(STANDARD_LABELS.SPAM)
    ) {
      queueAdd(STANDARD_LABELS.INBOX);
    }
  }

  if (mutation.trashed !== undefined) {
    if (mutation.trashed) {
      queueAdd(STANDARD_LABELS.TRASH);
      queueRemove(STANDARD_LABELS.INBOX);
      queueRemove(STANDARD_LABELS.SPAM);
    } else {
      queueRemove(STANDARD_LABELS.TRASH);
      if (!nextLabelIds.has(STANDARD_LABELS.SPAM)) {
        queueAdd(STANDARD_LABELS.INBOX);
      }
    }
  }

  if (mutation.spam !== undefined) {
    if (mutation.spam) {
      queueAdd(STANDARD_LABELS.SPAM);
      queueRemove(STANDARD_LABELS.INBOX);
      queueRemove(STANDARD_LABELS.TRASH);
    } else {
      queueRemove(STANDARD_LABELS.SPAM);
      if (!nextLabelIds.has(STANDARD_LABELS.TRASH)) {
        queueAdd(STANDARD_LABELS.INBOX);
      }
    }
  }

  if (mutation.starred !== undefined) {
    if (mutation.starred) {
      queueAdd(STANDARD_LABELS.STARRED);
    } else {
      queueRemove(STANDARD_LABELS.STARRED);
    }
  }

  if (mutation.snoozedUntil !== undefined) {
    snoozedUntil = mutation.snoozedUntil;
    dbUpdates.snoozedUntil = mutation.snoozedUntil;
  }

  const resolvedLabelIds = Array.from(nextLabelIds);
  if (!areLabelIdsEqual(currentLabelIds, resolvedLabelIds)) {
    dbUpdates.labelIds = resolvedLabelIds;
  }

  return {
    isRead,
    labelIds: resolvedLabelIds,
    archived: !nextLabelIds.has(STANDARD_LABELS.INBOX),
    trashed: nextLabelIds.has(STANDARD_LABELS.TRASH),
    spam: nextLabelIds.has(STANDARD_LABELS.SPAM),
    starred: nextLabelIds.has(STANDARD_LABELS.STARRED),
    snoozedUntil,
    dbUpdates,
    addLabelIds: Array.from(addLabelIds),
    removeLabelIds: Array.from(removeLabelIds),
  };
}
