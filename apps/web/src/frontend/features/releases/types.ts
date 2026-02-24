export interface ReleaseItem {
  id: string;
  releaseId: string;
  kind: string;
  title: string;
  description: string | null;
  prNumber: number | null;
  prUrl: string | null;
  prAuthor: string | null;
  sortOrder: number;
  createdAt: number;
}

export interface Release {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  version: string | null;
  notes: string | null;
  status: string;
  publishedAt: number | null;
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReleaseWithItems extends Release {
  items: ReleaseItem[];
}

export interface CreateReleaseInput {
  projectId: string;
  title: string;
  version?: string;
  slug?: string;
  notes?: string;
  items?: CreateReleaseItemInput[];
}

export interface CreateReleaseItemInput {
  kind?: string;
  title: string;
  description?: string;
  prNumber?: number;
  prUrl?: string;
  prAuthor?: string;
  sortOrder?: number;
}

export interface UpdateReleaseInput {
  title?: string;
  version?: string;
  notes?: string;
  status?: "draft" | "published";
  items?: CreateReleaseItemInput[];
}

export interface GithubConnection {
  id: string;
  projectId: string;
  repoOwner: string;
  repoName: string;
  createdByUserId: string;
  createdAt: number;
}

export interface GithubPullRequest {
  number: number;
  title: string;
  body: string | null;
  author: string;
  htmlUrl: string;
  mergedAt: string;
}
