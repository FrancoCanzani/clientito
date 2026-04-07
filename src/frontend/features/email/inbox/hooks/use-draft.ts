import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DraftState } from "../types";
import { getDraftsQueryKey } from "../queries/drafts";

const SAVE_DELAY_MS = 2000;

type ServerDraft = {
  id: number;
  composeKey: string;
  mailboxId: number | null;
  toAddr: string;
  ccAddr: string;
  bccAddr: string;
  subject: string;
  body: string;
  forwardedContent: string;
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
  await fetch("/api/inbox/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      composeKey,
      mailboxId: draft.mailboxId,
      toAddr: draft.to,
      ccAddr: draft.cc,
      bccAddr: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      forwardedContent: draft.forwardedContent ?? "",
    }),
  });
}

async function deleteDraftByKey(composeKey: string): Promise<void> {
  await fetch(
    `/api/inbox/drafts/by-key?composeKey=${encodeURIComponent(composeKey)}`,
    { method: "DELETE" },
  );
}

export async function loadDraft(composeKey: string): Promise<DraftState | null> {
  try {
    const response = await fetch(
      `/api/inbox/drafts/by-key?composeKey=${encodeURIComponent(composeKey)}`,
    );
    if (!response.ok) return null;

    const nextDraft: ServerDraft | null = await response.json();
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
  } catch {
    return null;
  }
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
        queryKey: getDraftsQueryKey(draftRef.current.mailboxId),
      });
    },
  };
}
