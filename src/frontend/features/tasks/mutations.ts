import type { Task, TaskPriority, TaskStatus } from "./types";

export async function createTask(input: {
  title: string;
  description?: string | null;
  dueAt?: number;
  priority?: TaskPriority;
  status?: TaskStatus;
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
    description?: string | null;
    dueAt?: number | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    position?: number;
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
