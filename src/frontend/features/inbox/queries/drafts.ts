import { queryOptions } from "@tanstack/react-query";

export type DraftItem = {
  id: number;
  composeKey: string;
  mailboxId: number | null;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  forwardedContent: string;
  threadId: string | null;
  attachmentKeys: Array<{ key: string; filename: string; mimeType: string }> | null;
  updatedAt: number;
  createdAt: number;
};

export async function fetchDrafts(): Promise<DraftItem[]> {
  const response = await fetch("/api/inbox/drafts");
  if (!response.ok) throw new Error("Failed to fetch drafts");
  const json = (await response.json()) as { data: DraftItem[] };
  return json.data;
}

export async function deleteDraft(id: number): Promise<void> {
  const response = await fetch(`/api/inbox/drafts/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete draft");
}

export const draftsQueryOptions = queryOptions({
  queryKey: ["drafts"],
  queryFn: fetchDrafts,
});
