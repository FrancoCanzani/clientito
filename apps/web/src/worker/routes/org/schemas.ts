import { z } from "@hono/zod-openapi";

export const createOrganizationRequestSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required"),
});

export const updateOrganizationRequestSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required"),
  aiContext: z.string().trim().nullable().optional(),
});

export const organizationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  aiContext: z.string().nullable(),
  createdByUserId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const organizationListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  aiContext: z.string().nullable(),
  role: z.string(),
  createdAt: z.number(),
});

export const listOrganizationsResponseSchema = z.object({
  data: z.array(organizationListItemSchema),
});

export const createOrganizationResponseSchema = z.object({
  data: organizationResponseSchema.nullable(),
});

export const updateOrganizationResponseSchema = z.object({
  data: organizationResponseSchema,
});
