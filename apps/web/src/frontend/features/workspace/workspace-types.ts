export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: number;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  githubRepoOwner: string | null;
  githubRepoName: string | null;
  githubConnectedByUserId: string | null;
  githubConnectedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceListResponse<T> {
  data: T[];
}

export interface WorkspaceItemResponse<T> {
  data: T;
}

export interface CreateOrganizationInput {
  name: string;
  slug?: string;
}

export interface CreateProjectInput {
  orgId: string;
  name: string;
  slug?: string;
}
