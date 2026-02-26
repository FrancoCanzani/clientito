import { z } from "@hono/zod-openapi";

export const customerSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  vatEin: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const customerListItemSchema = customerSchema.extend({
  emailCount: z.number(),
  latestEmailDate: z.number().nullable(),
  pendingRemindersCount: z.number(),
});

export const emailSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  gmailId: z.string(),
  threadId: z.string().nullable(),
  customerId: z.string().nullable(),
  fromAddr: z.string(),
  toAddr: z.string().nullable(),
  subject: z.string().nullable(),
  snippet: z.string().nullable(),
  bodyText: z.string().nullable(),
  date: z.number(),
  isCustomer: z.boolean(),
  classified: z.boolean(),
  createdAt: z.number(),
});

export const reminderSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  customerId: z.string(),
  userId: z.string(),
  message: z.string(),
  dueAt: z.number(),
  done: z.boolean(),
  createdAt: z.number(),
});

export const errorResponseSchema = z.object({
  error: z.string(),
});

export const listCustomersQuerySchema = z.object({
  orgId: z.string().trim().min(1, "orgId is required"),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  search: z.string().trim().optional(),
});

export const customerIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const createCustomerRequestSchema = z.object({
  orgId: z.string().trim().min(1, "orgId is required"),
  name: z.string().trim().min(1, "name is required"),
  email: z.string().trim().min(1, "email is required"),
  company: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  website: z.string().trim().optional(),
  vatEin: z.string().trim().optional(),
  address: z.string().trim().optional(),
  notes: z.string().optional(),
});

export const patchCustomerRequestSchema = z.object({
  name: z.string().trim().min(1).optional(),
  company: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  website: z.string().trim().nullable().optional(),
  vatEin: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  notes: z.string().optional(),
});

export const customerContactSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  domain: z.string(),
  emailCount: z.number(),
  latestEmailDate: z.number().nullable(),
  isPrimary: z.boolean(),
});

export const mergeCustomerRequestSchema = z.object({
  sourceCustomerId: z.string().trim().min(1, "sourceCustomerId is required"),
});

export const customerContactParamsSchema = customerIdParamsSchema.extend({
  email: z.string().trim().min(1),
});

export const addCustomerContactRequestSchema = z.object({
  email: z.string().trim().email("Invalid email"),
});

export const mutateCustomerContactResponseSchema = z.object({
  data: z.object({
    email: z.string(),
    emailsLinked: z.number(),
  }),
});
