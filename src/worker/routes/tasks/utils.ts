import { tasks } from "../../db/schema";

export const TASK_COLUMNS = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  sourceEmailId: tasks.sourceEmailId,
  dueAt: tasks.dueAt,
  priority: tasks.priority,
  status: tasks.status,
  completedAt: tasks.completedAt,
  position: tasks.position,
  createdAt: tasks.createdAt,
} as const;
