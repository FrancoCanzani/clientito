export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "done";
export type TaskSortMode = "date" | "priority";
export type TaskView = "all" | "today" | "upcoming";
export type TaskLayout = "list" | "board";

export type Task = {
  id: number;
  title: string;
  description: string | null;
  sourceEmailId: number | null;
  dueAt: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt: number | null;
  position: number;
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
