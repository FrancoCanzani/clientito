import { apiFetch } from "@/lib/api";
import type {
  ChecklistWithItems,
  ChecklistsResponse,
  CreateChecklistInput,
  CreateChecklistItemInput,
  UpdateChecklistInput,
} from "@/features/checklists/checklist_types";
import type { ChecklistItem } from "@releaselayer/shared";

export function fetchChecklists(projectId: string) {
  return apiFetch<ChecklistsResponse>(`/checklists?projectId=${projectId}`);
}

export function createChecklist(projectId: string, data: CreateChecklistInput) {
  return apiFetch<{ data: ChecklistWithItems }>(`/checklists?projectId=${projectId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateChecklist(checklistId: string, data: UpdateChecklistInput) {
  return apiFetch<{ data: ChecklistWithItems }>(`/checklists/${checklistId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteChecklist(checklistId: string) {
  return apiFetch<{ ok: boolean }>(`/checklists/${checklistId}`, {
    method: "DELETE",
  });
}

export function createChecklistItem(checklistId: string, data: CreateChecklistItemInput) {
  return apiFetch<{ data: ChecklistItem }>(`/checklists/${checklistId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteChecklistItem(checklistId: string, itemId: string) {
  return apiFetch<{ ok: boolean }>(`/checklists/${checklistId}/items/${itemId}`, {
    method: "DELETE",
  });
}
