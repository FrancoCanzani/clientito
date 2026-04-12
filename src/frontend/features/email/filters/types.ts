export type FilterActions = {
  archive?: boolean;
  markRead?: boolean;
  star?: boolean;
  applyCategory?:
    | "to_respond"
    | "to_follow_up"
    | "fyi"
    | "notification"
    | "invoice"
    | "marketing";
  trash?: boolean;
};

export type EmailFilter = {
  id: number;
  userId: string;
  name: string;
  description: string;
  actions: FilterActions;
  enabled: boolean;
  priority: number;
  createdAt: number;
};
