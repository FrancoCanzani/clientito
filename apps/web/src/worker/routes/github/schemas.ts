import { z } from "@hono/zod-openapi";

export const githubConnectionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  repoOwner: z.string(),
  repoName: z.string(),
  createdByUserId: z.string(),
  createdAt: z.number(),
});

export const createConnectionRequestSchema = z.object({
  projectId: z.string().trim().min(1, "projectId is required"),
  repoOwner: z.string().trim().min(1, "repoOwner is required"),
  repoName: z.string().trim().min(1, "repoName is required"),
});

export const getConnectionQuerySchema = z.object({
  projectId: z.string().trim().min(1, "projectId is required"),
});

export const getPullsQuerySchema = z.object({
  projectId: z.string().trim().min(1, "projectId is required"),
});

export const pullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  author: z.string(),
  htmlUrl: z.string(),
  mergedAt: z.string(),
});
