export type FilterActions = {
  archive?: boolean;
  markRead?: boolean;
  star?: boolean;
  applyAiLabel?:
    | "important"
    | "later"
    | "newsletter"
    | "transactional"
    | "notification";
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