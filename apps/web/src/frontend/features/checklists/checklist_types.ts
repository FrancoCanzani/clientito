import type { Checklist, ChecklistItem } from "@releaselayer/shared";

export type ChecklistWithItems = Checklist & { items: ChecklistItem[] };

export type ChecklistsResponse = { data: ChecklistWithItems[] };

export type CreateChecklistInput = {
  title: string;
  description?: string;
  targetTraits?: Record<string, unknown>;
};

export type UpdateChecklistInput = {
  title?: string;
  description?: string;
  targetTraits?: Record<string, unknown>;
  isActive?: boolean;
};

export type CreateChecklistItemInput = {
  title: string;
  trackEvent: string;
  description?: string;
  sortOrder?: number;
};
