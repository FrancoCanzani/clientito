import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// Organizations (tenants)
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Users
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Org membership
export const orgMembers = sqliteTable("org_members", {
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  primaryKey({ columns: [table.orgId, table.userId] }),
]);

// OAuth accounts
export const oauthAccounts = sqliteTable("oauth_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  uniqueIndex("oauth_provider_account").on(table.provider, table.providerAccountId),
]);

// Sessions (D1-backed)
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Projects
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  sdkKey: text("sdk_key").notNull().unique(),
  customDomain: text("custom_domain"),
  customDomainStatus: text("custom_domain_status").default("none"),
  cfHostnameId: text("cf_hostname_id"),
  brandingEnabled: integer("branding_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  uniqueIndex("project_org_slug").on(table.orgId, table.slug),
]);

// Releases
export const releases = sqliteTable("releases", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  version: text("version"),
  contentMd: text("content_md").notNull(),
  contentHtml: text("content_html"),
  aiRewriteMd: text("ai_rewrite_md"),
  aiRewriteHtml: text("ai_rewrite_html"),
  status: text("status").notNull().default("draft"),
  displayType: text("display_type").notNull().default("modal"),
  publishAt: integer("publish_at"),
  publishedAt: integer("published_at"),
  unpublishAt: integer("unpublish_at"),
  showOnce: integer("show_once", { mode: "boolean" }).notNull().default(true),
  targetTraits: text("target_traits"),
  metadata: text("metadata"),
  source: text("source").default("manual"),
  sourceRef: text("source_ref"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  uniqueIndex("release_project_slug").on(table.projectId, table.slug),
]);

// SDK config (per project)
export const sdkConfigs = sqliteTable("sdk_configs", {
  projectId: text("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  theme: text("theme").default("{}"),
  position: text("position").default("bottom-right"),
  zIndex: integer("z_index").default(99999),
  customCss: text("custom_css"),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Onboarding checklists
export const checklists = sqliteTable("checklists", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  targetTraits: text("target_traits"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const checklistItems = sqliteTable("checklist_items", {
  id: text("id").primaryKey(),
  checklistId: text("checklist_id").notNull().references(() => checklists.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  trackEvent: text("track_event").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// Impressions (append-only)
export const impressions = sqliteTable("impressions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  releaseId: text("release_id"),
  endUserId: text("end_user_id").notNull(),
  eventType: text("event_type").notNull(),
  eventData: text("event_data"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("idx_impressions_project").on(table.projectId, table.createdAt),
]);

// MAU tracking (daily unique)
export const mauDaily = sqliteTable("mau_daily", {
  projectId: text("project_id").notNull(),
  day: text("day").notNull(),
  endUserId: text("end_user_id").notNull(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.day, table.endUserId] }),
]);

// Monthly usage rollups
export const usageMonthly = sqliteTable("usage_monthly", {
  projectId: text("project_id").notNull(),
  month: text("month").notNull(),
  mauCount: integer("mau_count").notNull().default(0),
  impressionCount: integer("impression_count").notNull().default(0),
  aiRewriteCount: integer("ai_rewrite_count").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.month] }),
]);

// Integrations
export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  config: text("config").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
});

// AI rewrite audit log
export const aiRewrites = sqliteTable("ai_rewrites", {
  id: text("id").primaryKey(),
  releaseId: text("release_id").notNull().references(() => releases.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  inputMd: text("input_md").notNull(),
  outputMd: text("output_md").notNull(),
  model: text("model").notNull(),
  createdAt: integer("created_at").notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
});
