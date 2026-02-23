import type { Plan } from "./types";

export interface PlanLimits {
  mauLimit: number;
  impressionsLimit: number;
  projectsLimit: number;
  aiRewritesPerMonth: number;
  customDomain: boolean;
  removeBranding: boolean;
  integrations: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    mauLimit: 1_000,
    impressionsLimit: 5_000,
    projectsLimit: 1,
    aiRewritesPerMonth: 5,
    customDomain: false,
    removeBranding: false,
    integrations: false,
  },
  starter: {
    mauLimit: 5_000,
    impressionsLimit: 25_000,
    projectsLimit: 3,
    aiRewritesPerMonth: 25,
    customDomain: false,
    removeBranding: true,
    integrations: true,
  },
  growth: {
    mauLimit: 25_000,
    impressionsLimit: 100_000,
    projectsLimit: 10,
    aiRewritesPerMonth: 100,
    customDomain: true,
    removeBranding: true,
    integrations: true,
  },
  pro: {
    mauLimit: 100_000,
    impressionsLimit: 500_000,
    projectsLimit: 50,
    aiRewritesPerMonth: 500,
    customDomain: true,
    removeBranding: true,
    integrations: true,
  },
};
