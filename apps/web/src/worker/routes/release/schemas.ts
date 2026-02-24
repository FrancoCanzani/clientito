import { z } from "@hono/zod-openapi";

export const releaseItemSchema = z.object({
  id: z.string(),
  releaseId: z.string(),
  kind: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  prNumber: z.number().nullable(),
  prUrl: z.string().nullable(),
  prAuthor: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.number(),
});

export const releaseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  slug: z.string(),
  version: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.string(),
  publishedAt: z.number().nullable(),
  createdByUserId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const releaseWithItemsSchema = releaseSchema.extend({
  items: z.array(releaseItemSchema),
});

export const getReleasesQuerySchema = z.object({
  projectId: z.string().trim().min(1, "projectId is required"),
});

export const getReleasesResponseSchema = z.object({
  data: z.array(releaseSchema),
});

export const getReleaseResponseSchema = z.object({
  data: releaseWithItemsSchema,
});

export const createReleaseItemInputSchema = z.object({
  kind: z.string().default("manual"),
  title: z.string().min(1),
  description: z.string().optional(),
  prNumber: z.number().optional(),
  prUrl: z.string().optional(),
  prAuthor: z.string().optional(),
  sortOrder: z.number().default(0),
});

export const createReleaseRequestSchema = z.object({
  projectId: z.string().trim().min(1, "projectId is required"),
  title: z.string().trim().min(1, "Title is required"),
  version: z.string().trim().optional(),
  slug: z.string().trim().optional(),
  notes: z.string().optional(),
  items: z.array(createReleaseItemInputSchema).optional(),
});

export const createReleaseResponseSchema = z.object({
  data: releaseWithItemsSchema.nullable(),
});

export const updateReleaseRequestSchema = z.object({
  title: z.string().trim().min(1).optional(),
  version: z.string().trim().optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  items: z.array(createReleaseItemInputSchema).optional(),
});

export const updateReleaseResponseSchema = z.object({
  data: releaseWithItemsSchema,
});

export const deleteReleaseResponseSchema = z.object({
  success: z.boolean(),
});
