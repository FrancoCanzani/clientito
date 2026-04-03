import type { TaskListResponse, TaskStatus, TaskView } from "./types";

export async function fetchTasks(params?: {
  view?: TaskView;
  status?: TaskStatus;
  dueToday?: boolean;
  dueAfter?: number;
  dueBefore?: number;
  sourceEmailId?: number;
  limit?: number;
  offset?: number;
}): Promise<TaskListResponse> {
  const query = new URLSearchParams();
  if (params?.view && params.view !== "all")
    query.set("view", params.view);
  if (params?.status !== undefined)
    query.set("status", params.status);
  if (params?.dueToday !== undefined)
    query.set("dueToday", String(params.dueToday));
  if (params?.dueAfter !== undefined)
    query.set("dueAfter", String(params.dueAfter));
  if (params?.dueBefore !== undefined)
    query.set("dueBefore", String(params.dueBefore));
  if (params?.sourceEmailId !== undefined)
    query.set("sourceEmailId", String(params.sourceEmailId));
  if (params?.limit !== undefined)
    query.set("limit", String(params.limit));
  if (params?.offset !== undefined)
    query.set("offset", String(params.offset));

  const response = await fetch(`/api/tasks?${query.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch tasks");
  return response.json();
}
