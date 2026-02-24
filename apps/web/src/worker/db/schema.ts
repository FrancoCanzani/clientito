import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { user } from "./auth-schema";

export const organizations = sqliteTable(
  "organizations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).$type<string>(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  }
);

export const orgMembers = sqliteTable(
  "org_members",
  {
    orgId: integer("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .$type<string>(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.orgId, table.userId] })]
);

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }).$type<string>(),
    orgId: integer("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .$type<string>(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    githubRepoOwner: text("github_repo_owner"),
    githubRepoName: text("github_repo_name"),
    githubConnectedByUserId: text("github_connected_by_user_id"),
    githubConnectedAt: integer("github_connected_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("project_org_slug").on(table.orgId, table.slug)]
);

export const releases = sqliteTable(
  "releases",
  {
    id: text("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" })
      .$type<string>(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    version: text("version"),
    notes: text("notes"),
    status: text("status").notNull().default("draft"),
    publishedAt: integer("published_at"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("release_project_slug").on(table.projectId, table.slug)]
);

export const releaseItems = sqliteTable("release_items", {
  id: text("id").primaryKey(),
  releaseId: text("release_id")
    .notNull()
    .references(() => releases.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("manual"),
  title: text("title").notNull(),
  description: text("description"),
  prNumber: integer("pr_number"),
  prUrl: text("pr_url"),
  prAuthor: text("pr_author"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const releasesRelations = relations(releases, ({ many }) => ({
  items: many(releaseItems),
}));

export const releaseItemsRelations = relations(releaseItems, ({ one }) => ({
  release: one(releases, {
    fields: [releaseItems.releaseId],
    references: [releases.id],
  }),
}));
