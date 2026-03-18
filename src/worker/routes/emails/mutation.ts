import { emails } from "../../db/schema";

export type EmailPatchMutation = {
  isRead?: boolean;
  archived?: boolean;
  trashed?: boolean;
  spam?: boolean;
  starred?: boolean;
};

type EmailPatchSource = {
  isRead: boolean;
  labelIds: string[] | null;
};

export type EmailPatchResult = {
  isRead: boolean;
  labelIds: string[];
  archived: boolean;
  trashed: boolean;
  spam: boolean;
  starred: boolean;
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
      queueRemove("UNREAD");
    } else {
      queueAdd("UNREAD");
    }
  }

  if (mutation.archived !== undefined) {
    if (mutation.archived) {
      queueRemove("INBOX");
    } else if (!nextLabelIds.has("TRASH") && !nextLabelIds.has("SPAM")) {
      queueAdd("INBOX");
    }
  }

  if (mutation.trashed !== undefined) {
    if (mutation.trashed) {
      queueAdd("TRASH");
      queueRemove("INBOX");
      queueRemove("SPAM");
    } else {
      queueRemove("TRASH");
      if (!nextLabelIds.has("SPAM")) {
        queueAdd("INBOX");
      }
    }
  }

  if (mutation.spam !== undefined) {
    if (mutation.spam) {
      queueAdd("SPAM");
      queueRemove("INBOX");
      queueRemove("TRASH");
    } else {
      queueRemove("SPAM");
      if (!nextLabelIds.has("TRASH")) {
        queueAdd("INBOX");
      }
    }
  }

  if (mutation.starred !== undefined) {
    if (mutation.starred) {
      queueAdd("STARRED");
    } else {
      queueRemove("STARRED");
    }
  }

  const resolvedLabelIds = Array.from(nextLabelIds);
  if (!areLabelIdsEqual(currentLabelIds, resolvedLabelIds)) {
    dbUpdates.labelIds = resolvedLabelIds;
  }

  return {
    isRead,
    labelIds: resolvedLabelIds,
    archived: !nextLabelIds.has("INBOX"),
    trashed: nextLabelIds.has("TRASH"),
    spam: nextLabelIds.has("SPAM"),
    starred: nextLabelIds.has("STARRED"),
    dbUpdates,
    addLabelIds: Array.from(addLabelIds),
    removeLabelIds: Array.from(removeLabelIds),
  };
}
