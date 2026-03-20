export type Draft = {
  id: number;
  userId: string;
  to: string | null;
  cc: string | null;
  subject: string | null;
  body: string | null;
  inReplyTo: string | null;
  threadId: string | null;
  updatedAt: number;
  createdAt: number;
};

type DraftInput = {
  id?: number;
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  inReplyTo?: string;
  threadId?: string;
};

export async function fetchDrafts(): Promise<Draft[]> {
  const response = await fetch("/api/drafts");
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      (payload as { error?: string }).error ?? "Failed to fetch drafts",
    );
  }
  const json = (await response.json()) as { data: Draft[] };
  return json.data;
}

export async function fetchDraft(id: number): Promise<Draft> {
  const response = await fetch(`/api/drafts/${id}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      (payload as { error?: string }).error ?? "Failed to fetch draft",
    );
  }
  const json = (await response.json()) as { data: Draft };
  return json.data;
}

export async function saveDraft(data: DraftInput): Promise<Draft> {
  const { id, ...body } = data;
  const url = id ? `/api/drafts/${id}` : "/api/drafts";
  const method = id ? "PUT" : "POST";

  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      (payload as { error?: string }).error ?? "Failed to save draft",
    );
  }

  const json = (await response.json()) as { data: Draft };
  return json.data;
}

export async function deleteDraft(id: number): Promise<void> {
  const response = await fetch(`/api/drafts/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      (payload as { error?: string }).error ?? "Failed to delete draft",
    );
  }
}
