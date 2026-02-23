import type { Project, Release } from "@releaselayer/shared";

export type ProjectsResponse = { data: Project[] };

export type CreateProjectInput = {
  name: string;
  slug: string;
};

export type ProjectResponse = { data: Project };

export type ReleasesResponse = { data: Release[] };

export type UsageSummaryResponse = {
  data: {
    today: string;
    month: string;
    todayStats: { impressions: number; mau: number };
    currentMonth: { impressions: number; mau: number };
    lifetime: { impressions: number };
  };
};
