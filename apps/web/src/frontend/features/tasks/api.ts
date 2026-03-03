import type { Task, TaskListResponse } from "./types";

export async function fetchTasks(params?: {
  dueToday?: boolean;
  limit?: number;
  offset?: number;
}): Promise<TaskListResponse> {
  const query = new URLSearchParams();
  if (params?.dueToday !== undefined) {
    query.set("dueToday", String(params.dueToday));
  }
  if (params?.limit !== undefined) {
    query.set("limit", String(params.limit));
  }
  if (params?.offset !== undefined) {
    query.set("offset", String(params.offset));
  }

  const response = await fetch(`/api/tasks?${query.toString()}`, {
  });
  if (!response.ok) throw new Error("Failed to fetch tasks");
  return response.json();
}

export async function createTask(input: {
  title: string;
  dueAt?: number;
  personId?: number;
  companyId?: number;
}): Promise<Task> {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Failed to create task");
  const json = await response.json();
  return json.data;
}

export async function updateTask(
  taskId: number,
  input: {
    title?: string;
    dueAt?: number | null;
    done?: boolean;
    personId?: number | null;
    companyId?: number | null;
  },
): Promise<Task> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Failed to update task");
  const json = await response.json();
  return json.data;
}

export async function deleteTask(taskId: number): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete task");
}
