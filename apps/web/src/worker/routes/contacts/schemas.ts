import { z } from "@hono/zod-openapi";

export const listContactsQuerySchema = z.object({
  orgId: z.string().trim().min(1, "orgId is required"),
  search: z.string().trim().optional(),
});

export const contactItemSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  domain: z.string(),
  emailCount: z.number(),
  latestEmailDate: z.number().nullable(),
  isAlreadyCustomer: z.boolean(),
});

export const createCustomersFromContactsRequestSchema = z.object({
  orgId: z.string().trim().min(1, "orgId is required"),
  emails: z.array(z.string().trim().min(1)).min(1, "At least one email required"),
});

export const createCustomersFromContactsResponseSchema = z.object({
  data: z.object({
    customersCreated: z.number(),
    emailsLinked: z.number(),
  }),
});

export const errorResponseSchema = z.object({
  error: z.string(),
});
