export type Plan = "free" | "starter" | "growth" | "pro";
export type OrgRole = "owner" | "admin" | "member";
export type ReleaseStatus = "draft" | "scheduled" | "published" | "archived";
export type DisplayType = "modal" | "banner" | "changelog";
export type ReleaseSource = "manual" | "github" | "gitlab" | "webhook";
export type IntegrationType = "github" | "gitlab" | "slack" | "custom_webhook";
export type DomainStatus = "none" | "pending" | "active" | "error";
export type EventType = "view" | "dismiss" | "click" | "checklist_complete";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  avatarUrl: string | null;
  createdAt: number;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  sdkKey: string;
  customDomain: string | null;
  customDomainStatus: DomainStatus;
  cfHostnameId: string | null;
  brandingEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Release {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  version: string | null;
  contentMd: string;
  contentHtml: string | null;
  aiRewriteMd: string | null;
  aiRewriteHtml: string | null;
  status: ReleaseStatus;
  displayType: DisplayType;
  publishAt: number | null;
  publishedAt: number | null;
  unpublishAt: number | null;
  showOnce: boolean;
  targetTraits: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  source: ReleaseSource;
  sourceRef: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SdkConfig {
  projectId: string;
  theme: Record<string, unknown>;
  position: string;
  zIndex: number;
  customCss: string | null;
  updatedAt: number;
}

export interface Checklist {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  isActive: boolean;
  targetTraits: Record<string, unknown> | null;
  createdAt: number;
}

export interface ChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  description: string | null;
  trackEvent: string;
  sortOrder: number;
  createdAt: number;
}

export interface Integration {
  id: string;
  projectId: string;
  type: IntegrationType;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: number;
}
