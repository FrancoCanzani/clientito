import type { EmailFilter, FilterActions } from "./types";

export async function fetchFilters(): Promise<EmailFilter[]> {
  const res = await fetch("/api/inbox/filters");
  if (!res.ok) throw new Error("Failed to fetch filters");
  const json = (await res.json()) as { data: EmailFilter[] };
  return json.data;
}

export async function createFilter(input: {
  name: string;
  description: string;
  actions: FilterActions;
  enabled?: boolean;
  priority?: number;
}): Promise<EmailFilter> {
  const res = await fetch("/api/inbox/filters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create filter");
  const json = (await res.json()) as { data: EmailFilter };
  return json.data;
}

export async function updateFilter(
  id: number,
  input: Partial<{
    name: string;
    description: string;
    actions: FilterActions;
    enabled: boolean;
    priority: number;
  }>,
): Promise<EmailFilter> {
  const res = await fetch(`/api/inbox/filters/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update filter");
  const json = (await res.json()) as { data: EmailFilter };
  return json.data;
}

export async function deleteFilter(id: number): Promise<void> {
  const res = await fetch(`/api/inbox/filters/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete filter");
}

export type GeneratedFilter = {
  name: string;
  description: string;
  actions: FilterActions;
};

export async function generateFilter(
  prompt: string,
): Promise<GeneratedFilter> {
  const res = await fetch("/api/inbox/filters/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Failed to generate filter");
  const json = (await res.json()) as { data: GeneratedFilter };
  return json.data;
}
