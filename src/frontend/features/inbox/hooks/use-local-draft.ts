import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const SAVE_DELAY_MS = 2000;

type DraftState = {
  mailboxId: number | null;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  forwardedContent?: string;
};

type ServerDraft = DraftState & {
  id: number;
  composeKey: string;
  updatedAt: number;
  createdAt: number;
};

function isDraftEmpty(d: DraftState): boolean {
  return (
    !d.to &&
    !d.cc &&
    !d.bcc &&
    !d.subject &&
    (!d.body || d.body === "<p></p>" || d.body === "<p><br></p>") &&
    !d.forwardedContent
  );
}

async function saveDraft(
  composeKey: string,
  draft: DraftState,
): Promise<void> {
  await fetch("/api/inbox/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      composeKey,
      mailboxId: draft.mailboxId,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
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

export function useLocalDraft(composeKey: string, draft: DraftState) {
  const queryClient = useQueryClient();
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const timer = setTimeout(() => {
      const d = draftRef.current;
      if (isDraftEmpty(d)) {
        deleteDraftByKey(composeKey);
      } else {
        saveDraft(composeKey, d);
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, composeKey]);

  return {
    clearDraft: () => {
      deleteDraftByKey(composeKey);
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  };
}

useLocalDraft.load = async function loadDraft(
  composeKey: string,
): Promise<DraftState | null> {
  try {
    const response = await fetch(
      `/api/inbox/drafts/by-key?composeKey=${encodeURIComponent(composeKey)}`,
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { data: ServerDraft | null };
    if (!json.data) return null;
    const d = json.data;
    return {
      mailboxId: d.mailboxId ?? null,
      to: d.to,
      cc: d.cc,
      bcc: d.bcc,
      subject: d.subject,
      body: d.body,
      forwardedContent: d.forwardedContent ?? "",
    };
  } catch {
    return null;
  }
};
