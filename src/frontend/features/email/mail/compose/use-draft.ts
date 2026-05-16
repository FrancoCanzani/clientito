import { draftQueryKeys } from "@/features/email/mail/shared/query-keys";
import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DraftState } from "@/features/email/mail/shared/types";

const SAVE_DELAY_MS = 2000;

export type DraftStatus = "idle" | "saving" | "saved";

function draftsEqual(a: DraftState, b: DraftState) {
 return (
 a.to === b.to &&
 a.cc === b.cc &&
 a.bcc === b.bcc &&
 a.subject === b.subject &&
 a.body === b.body &&
 (a.forwardedContent ?? "") === (b.forwardedContent ?? "") &&
 a.mailboxId === b.mailboxId &&
 JSON.stringify(a.attachmentKeys) === JSON.stringify(b.attachmentKeys)
 );
}

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
 attachmentKeys: DraftState["attachmentKeys"] | null;
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
 !draft.forwardedContent &&
 draft.attachmentKeys.length === 0
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
 attachmentKeys: draft.attachmentKeys,
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
 attachmentKeys: nextDraft.attachmentKeys ?? [],
 };
 } catch (error) {
 console.warn("Failed to load draft", error);
 return null;
 }
}

export function useDraft(composeKey: string, draft: DraftState) {
 const queryClient = useQueryClient();
 const draftRef = useRef(draft);
 draftRef.current = draft;
 const lastSavedSnapshot = useRef<DraftState | null>(null);
 const [status, setStatus] = useState<DraftStatus>("idle");
 const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

 useEffect(() => {
 const isEmpty = isDraftEmpty(draft);
 const matchesSaved =
 lastSavedSnapshot.current != null &&
 draftsEqual(draft, lastSavedSnapshot.current);

 if (matchesSaved) return;

 if (isEmpty && lastSavedSnapshot.current == null) {
 return;
 }

 setStatus("saving");

 const timer = setTimeout(() => {
 const currentDraft = draftRef.current;
 if (isDraftEmpty(currentDraft)) {
 void deleteDraftByKey(composeKey).then(() => {
 lastSavedSnapshot.current = null;
 setLastSavedAt(null);
 setStatus("idle");
 });
 } else {
 void saveDraft(composeKey, currentDraft).then(() => {
 lastSavedSnapshot.current = currentDraft;
 setLastSavedAt(Date.now());
 setStatus("saved");
 });
 }
 }, SAVE_DELAY_MS);

 return () => clearTimeout(timer);
 }, [draft, composeKey]);

 return {
 status,
 lastSavedAt,
 clearDraft: async () => {
 await deleteDraftByKey(composeKey);
 lastSavedSnapshot.current = null;
 setLastSavedAt(null);
 setStatus("idle");
 queryClient.invalidateQueries({
 queryKey: draftQueryKeys.list(draftRef.current.mailboxId),
 });
 },
 };
}
