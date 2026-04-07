import type { EmailFilter, FilterActions } from "./types";

function getErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = Reflect.get(payload, "error");
  return typeof error === "string" ? error : null;
}

export async function fetchFilters(): Promise<EmailFilter[]> {
  const res = await fetch("/api/inbox/filters");
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(getErrorMessage(payload) ?? "Failed to fetch filters");
  }
  const json: EmailFilter[] = await res.json();
  return json;
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
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(getErrorMessage(payload) ?? "Failed to create filter");
  }
  const json: EmailFilter = await res.json();
  return json;
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
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(getErrorMessage(payload) ?? "Failed to update filter");
  }
  const json: EmailFilter = await res.json();
  return json;
}

export async function deleteFilter(id: number): Promise<void> {
  const res = await fetch(`/api/inbox/filters/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(getErrorMessage(payload) ?? "Failed to delete filter");
  }
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
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(getErrorMessage(payload) ?? "Failed to generate filter");
  }
  const json: GeneratedFilter = await res.json();
  return json;
}
