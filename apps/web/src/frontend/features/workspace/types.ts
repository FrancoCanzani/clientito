export interface Organization {
  id: string;
  name: string;
  slug: string;
  aiContext: string | null;
  role: string;
  createdAt: number;
}

export interface WorkspaceListResponse<T> {
  data: T[];
}

export interface WorkspaceItemResponse<T> {
  data: T;
}

export interface CreateOrganizationInput {
  name: string;
}

export interface UpdateOrganizationInput {
  name: string;
  aiContext?: string | null;
}
