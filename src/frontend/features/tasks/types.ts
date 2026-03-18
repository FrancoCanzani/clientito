export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskSortMode = "date" | "priority";

export type Task = {
  id: number;
  title: string;
  description: string | null;
  dueAt: number | null;
  priority: TaskPriority;
  done: boolean;
  createdAt: number;
};

export type TaskListResponse = {
  data: Task[];
  pagination: {
    total: number;
    limit: number | null;
    offset: number;
  };
};
