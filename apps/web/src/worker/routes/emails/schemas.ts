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
