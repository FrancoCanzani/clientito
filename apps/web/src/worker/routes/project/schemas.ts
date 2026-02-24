import { z } from "@hono/zod-openapi";

export const createProjectRequestSchema = z.object({
  orgId: z.string().trim().min(1, "orgId is required"),
  name: z.string().trim().min(1, "Project name is required"),
  slug: z.string().trim().optional(),
});

export const getProjectsQuerySchema = z.object({
  orgId: z.string().trim().min(1, "orgId is required"),
});

export const projectSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  slug: z.string(),
  githubRepoOwner: z.string().nullable(),
  githubRepoName: z.string().nullable(),
  githubConnectedByUserId: z.string().nullable(),
  githubConnectedAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const getProjectsResponseSchema = z.object({
  data: z.array(projectSchema),
});

export const createProjectResponseSchema = z.object({
  data: projectSchema.nullable(),
});
