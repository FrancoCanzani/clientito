import { createProjectSchema } from "@releaselayer/shared";

export const createProjectFormSchema = createProjectSchema.transform((data) => ({
  name: data.name.trim(),
  slug: data.slug.trim().toLowerCase(),
}));

export const ORG_STORAGE_KEY = "rl_selected_org_id";
export const ORG_CHANGED_EVENT = "rl:org-changed";

export function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function getStoredOrgId() {
  try {
    return localStorage.getItem(ORG_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredOrgId(orgId: string) {
  try {
    localStorage.setItem(ORG_STORAGE_KEY, orgId);
    window.dispatchEvent(new Event(ORG_CHANGED_EVENT));
  } catch {
    // best effort persistence only
  }
}
