export type FilterActions = {
  archive?: boolean;
  markRead?: boolean;
  star?: boolean;
  applyAiLabel?:
    | "action_needed"
    | "important"
    | "later"
    | "newsletter"
    | "marketing"
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
