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
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  };
}

useDraft.load = async function loadDraft(
  composeKey: string,
): Promise<DraftState | null> {
  try {
    const response = await fetch(
      `/api/inbox/drafts/by-key?composeKey=${encodeURIComponent(composeKey)}`,
    );
    if (!response.ok) return null;

    const json = (await response.json()) as { data: ServerDraft | null };
    if (!json.data) return null;

    const draft = json.data;
    return {
      mailboxId: draft.mailboxId ?? null,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      forwardedContent: draft.forwardedContent ?? "",
    };
  } catch {
    return null;
  }
};
