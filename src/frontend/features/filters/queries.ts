import type {
  EmailFilter,
  FilterActions,
  FilterCondition,
  FilterTestResult,
} from "./types";

export async function fetchFilters(): Promise<EmailFilter[]> {
  const res = await fetch("/api/filters");
  if (!res.ok) throw new Error("Failed to fetch filters");
  const json = (await res.json()) as { data: EmailFilter[] };
  return json.data;
}

export async function createFilter(input: {
  name: string;
  conditions: FilterCondition[];
  actions: FilterActions;
  enabled?: boolean;
  priority?: number;
}): Promise<EmailFilter> {
  const res = await fetch("/api/filters", {
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
    conditions: FilterCondition[];
    actions: FilterActions;
    enabled: boolean;
    priority: number;
  }>,
): Promise<EmailFilter> {
  const res = await fetch(`/api/filters/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update filter");
  const json = (await res.json()) as { data: EmailFilter };
  return json.data;
}

export async function deleteFilter(id: number): Promise<void> {
  const res = await fetch(`/api/filters/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete filter");
}

export async function testFilter(input: {
  conditions: FilterCondition[];
  actions: FilterActions;
}): Promise<FilterTestResult> {
  const res = await fetch("/api/filters/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to test filter");
  const json = (await res.json()) as { data: FilterTestResult };
  return json.data;
}
