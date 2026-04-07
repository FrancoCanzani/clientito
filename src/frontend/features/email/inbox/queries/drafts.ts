export type DraftItem = {
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
  attachmentKeys: Array<{ key: string; filename: string; mimeType: string }> | null;
  updatedAt: number;
  createdAt: number;
};

export function getDraftsQueryKey(mailboxId: number | null) {
  return ["drafts", mailboxId ?? "none"] as const;
}

export async function fetchDrafts(mailboxId: number | null): Promise<DraftItem[]> {
  const search =
    mailboxId == null
      ? ""
      : `?mailboxId=${encodeURIComponent(String(mailboxId))}`;
  const response = await fetch(`/api/inbox/drafts${search}`);
  if (!response.ok) throw new Error("Failed to fetch drafts");
  const json: DraftItem[] = await response.json();
  return json;
}

export async function deleteDraft(id: number): Promise<void> {
  const response = await fetch(`/api/inbox/drafts/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete draft");
}
