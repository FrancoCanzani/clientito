import { z } from "@hono/zod-openapi";

export const errorResponseSchema = z.object({ error: z.string() });

export const emailSearchItemSchema = z.object({
  id: z.string(),
  gmailId: z.string(),
  fromAddr: z.string(),
  toAddr: z.string().nullable(),
  subject: z.string().nullable(),
  snippet: z.string().nullable(),
  date: z.number(),
  isCustomer: z.boolean(),
  customerId: z.string().nullable(),
  customerName: z.string().nullable(),
});

export const searchEmailsQuerySchema = z.object({
  orgId: z.string().trim().min(1),
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const searchEmailsResponseSchema = z.object({
  data: z.array(emailSearchItemSchema),
});

export const listEmailsQuerySchema = z.object({
  orgId: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  search: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  isCustomer: z.enum(["true", "false"]).optional(),
});

export const emailListItemSchema = emailSearchItemSchema.extend({
  bodyText: z.string().nullable(),
  threadId: z.string().nullable(),
  classified: z.boolean(),
  createdAt: z.number(),
});

export const listEmailsResponseSchema = z.object({
  data: z.array(emailListItemSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
});

export const markAsCustomerRequestSchema = z.object({
  orgId: z.string().trim().min(1),
  emailAddress: z.string().trim().min(1),
  name: z.string().trim().optional(),
  company: z.string().trim().optional(),
});

export const markAsCustomerResponseSchema = z.object({
  data: z.object({
    customerId: z.string(),
    emailsLinked: z.number(),
  }),
});
