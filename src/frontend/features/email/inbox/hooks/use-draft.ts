import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { queryKeys } from "@/lib/query-keys";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DraftState } from "../types";

const SAVE_DELAY_MS = 2000;

type PersistedDraft = {
  id: number;
  composeKey: string;
  mailboxId: number | null;
  toAddr: string;
  ccAddr: string;
  bccAddr: string;
  subject: string;
  body: string;
  forwardedContent: string;
  threadId: string | null;
  updatedAt: number;
  createdAt: number;
};

function isDraftEmpty(draft: DraftState): boolean {
  return (
    !draft.to &&
    !draft.cc &&
    !draft.bcc &&
    !draft.subject &&
    (!draft.body ||
      draft.body === "<p></p>" ||
      draft.body === "<p><br></p>") &&
    !draft.forwardedContent
  );
}

async function saveDraft(composeKey: string, draft: DraftState): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await localDb.upsertDraft({
    userId,
    composeKey,
    mailboxId: draft.mailboxId,
    toAddr: draft.to,
    ccAddr: draft.cc,
    bccAddr: draft.bcc,
    subject: draft.subject,
    body: draft.body,
    forwardedContent: draft.forwardedContent ?? "",
    threadId: null,
    attachmentKeys: null,
  });
}

async function deleteDraftByKey(composeKey: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const existing = await localDb.getDraftByKey(userId, composeKey);
  if (!existing) return;

  await localDb.deleteDraft(existing.id, userId);
}

export async function loadDraft(composeKey: string): Promise<DraftState | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  try {
    const nextDraft: PersistedDraft | null = await localDb.getDraftByKey(
      userId,
      composeKey,
    );

    if (!nextDraft) return null;

    return {
      mailboxId: nextDraft.mailboxId ?? null,
      to: nextDraft.toAddr,
      cc: nextDraft.ccAddr,
      bcc: nextDraft.bccAddr,
      subject: nextDraft.subject,
      body: nextDraft.body,
      forwardedContent: nextDraft.forwardedContent ?? "",
    };
  } catch (error) {
    console.warn("Failed to load draft", error);
    return null;
  }
}

export async function persistDraftNow(
  composeKey: string,
  draft: DraftState,
): Promise<void> {
  if (isDraftEmpty(draft)) {
    await deleteDraftByKey(composeKey);
    return;
  }

  await saveDraft(composeKey, draft);
}

export function useDraft(composeKey: string, draft: DraftState) {
  const queryClient = useQueryClient();
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const timer = setTimeout(() => {
      const currentDraft = draftRef.current;
      if (isDraftEmpty(currentDraft)) {
        void deleteDraftByKey(composeKey);
      } else {
        void saveDraft(composeKey, currentDraft);
      }
    }, SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [draft, composeKey]);

  return {
    clearDraft: async () => {
      await deleteDraftByKey(composeKey);
      queryClient.invalidateQueries({
        queryKey: queryKeys.drafts(draftRef.current.mailboxId),
      });
    },
  };
}
