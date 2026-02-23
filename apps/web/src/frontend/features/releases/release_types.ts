import type { DisplayType, Release } from "@releaselayer/shared";

export type ReleaseResponse = { data: Release };

export type CreateReleaseInput = {
  title: string;
  slug: string;
  version?: string;
  contentMd: string;
  displayType: DisplayType;
  showOnce: boolean;
  publishAt?: number;
  unpublishAt?: number;
};

export type UpdateReleaseInput = Partial<Release>;
