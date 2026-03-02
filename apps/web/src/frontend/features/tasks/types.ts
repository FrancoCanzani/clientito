export type Task = {
  id: number;
  title: string;
  dueAt: number | null;
  done: boolean;
  personId: number | null;
  companyId: number | null;
  createdAt: number;
};

export type TaskListResponse = {
  data: Task[];
  pagination: {
    limit: number;
    offset: number;
  };
};
