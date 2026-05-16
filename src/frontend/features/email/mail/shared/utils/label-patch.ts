export const STANDARD_LABELS = {
  INBOX: "INBOX",
  SENT: "SENT",
  SPAM: "SPAM",
  TRASH: "TRASH",
  STARRED: "STARRED",
  UNREAD: "UNREAD",
} as const;

export type LabelPatch = {
  isRead?: boolean;
  archived?: boolean;
  trashed?: boolean;
  spam?: boolean;
  starred?: boolean;
};

export type LabelPatchResult = {
  labelIds: string[];
  isRead: boolean;
  addLabelIds: string[];
  removeLabelIds: string[];
};

export function applyLabelPatch(
  currentLabelIds: string[],
  currentIsRead: boolean,
  patch: LabelPatch,
): LabelPatchResult {
  const next = new Set(currentLabelIds);
  const add = new Set<string>();
  const remove = new Set<string>();
  let isRead = currentIsRead;

  const queueAdd = (id: string) => {
    if (next.has(id)) return;
    next.add(id);
    remove.delete(id);
    add.add(id);
  };
  const queueRemove = (id: string) => {
    if (!next.has(id)) return;
    next.delete(id);
    add.delete(id);
    remove.add(id);
  };

  if (patch.isRead !== undefined && patch.isRead !== currentIsRead) {
    isRead = patch.isRead;
    if (patch.isRead) queueRemove(STANDARD_LABELS.UNREAD);
    else queueAdd(STANDARD_LABELS.UNREAD);
  }

  if (patch.archived !== undefined) {
    if (patch.archived) queueRemove(STANDARD_LABELS.INBOX);
    else if (!next.has(STANDARD_LABELS.TRASH) && !next.has(STANDARD_LABELS.SPAM))
      queueAdd(STANDARD_LABELS.INBOX);
  }

  if (patch.trashed !== undefined) {
    if (patch.trashed) {
      queueAdd(STANDARD_LABELS.TRASH);
      queueRemove(STANDARD_LABELS.INBOX);
      queueRemove(STANDARD_LABELS.SPAM);
    } else {
      queueRemove(STANDARD_LABELS.TRASH);
      if (!next.has(STANDARD_LABELS.SPAM)) queueAdd(STANDARD_LABELS.INBOX);
    }
  }

  if (patch.spam !== undefined) {
    if (patch.spam) {
      queueAdd(STANDARD_LABELS.SPAM);
      queueRemove(STANDARD_LABELS.INBOX);
      queueRemove(STANDARD_LABELS.TRASH);
    } else {
      queueRemove(STANDARD_LABELS.SPAM);
      if (!next.has(STANDARD_LABELS.TRASH)) queueAdd(STANDARD_LABELS.INBOX);
    }
  }

  if (patch.starred !== undefined) {
    if (patch.starred) queueAdd(STANDARD_LABELS.STARRED);
    else queueRemove(STANDARD_LABELS.STARRED);
  }

  return {
    labelIds: Array.from(next),
    isRead,
    addLabelIds: Array.from(add),
    removeLabelIds: Array.from(remove),
  };
}