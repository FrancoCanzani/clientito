import type { TaskListResponse } from "./types";

export async function fetchTasks(params?: {
  dueToday?: boolean;
  dueAfter?: number;
  dueBefore?: number;
  done?: boolean;
  limit?: number;
  offset?: number;
}): Promise<TaskListResponse> {
  const query = new URLSearchParams();
  if (params?.dueToday !== undefined) {
    query.set("dueToday", String(params.dueToday));
  }
  if (params?.dueAfter !== undefined) {
    query.set("dueAfter", String(params.dueAfter));
  }
  if (params?.dueBefore !== undefined) {
    query.set("dueBefore", String(params.dueBefore));
  }
  if (params?.done !== undefined) {
    query.set("done", String(params.done));
  }
  if (params?.limit !== undefined) {
    query.set("limit", String(params.limit));
  }
  if (params?.offset !== undefined) {
    query.set("offset", String(params.offset));
  }

  const response = await fetch(`/api/tasks?${query.toString()}`, {});
  if (!response.ok) throw new Error("Failed to fetch tasks");
  return response.json();
}
