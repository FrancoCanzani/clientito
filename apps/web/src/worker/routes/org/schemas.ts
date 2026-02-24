import { z } from "@hono/zod-openapi";

export const createOrganizationRequestSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required"),
  slug: z.string().trim().optional(),
});

export const organizationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdByUserId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const organizationListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: z.string(),
  createdAt: z.number(),
});

export const listOrganizationsResponseSchema = z.object({
  data: z.array(organizationListItemSchema),
});

export const createOrganizationResponseSchema = z.object({
  data: organizationResponseSchema.nullable(),
});
