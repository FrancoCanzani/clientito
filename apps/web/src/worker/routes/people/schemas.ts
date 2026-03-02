import { z } from "@hono/zod-openapi";

export const errorResponseSchema = z.object({ error: z.string() });

export const personIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const getPeopleQuerySchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const personSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string().nullable(),
  companyId: z.number().nullable(),
  companyName: z.string().nullable(),
  companyDomain: z.string().nullable(),
  lastContactedAt: z.number().nullable(),
  createdAt: z.number(),
});

export const personEmailSchema = z.object({
  id: z.number(),
  threadId: z.string().nullable(),
  fromAddr: z.string(),
  toAddr: z.string().nullable(),
  subject: z.string().nullable(),
  snippet: z.string().nullable(),
  date: z.number(),
  direction: z.enum(["sent", "received"]).nullable(),
  isRead: z.boolean(),
});

export const personTaskSchema = z.object({
  id: z.number(),
  title: z.string(),
  dueAt: z.number().nullable(),
  done: z.boolean(),
  personId: z.number().nullable(),
  companyId: z.number().nullable(),
  createdAt: z.number(),
});

export const personNoteSchema = z.object({
  id: z.number(),
  content: z.string(),
  personId: z.number().nullable(),
  companyId: z.number().nullable(),
  createdAt: z.number(),
});

export const listPeopleResponseSchema = z.object({
  data: z.array(personSchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
  }),
});

export const getPersonResponseSchema = z.object({
  data: z.object({
    person: personSchema,
    recentEmails: z.array(personEmailSchema),
    openTasks: z.array(personTaskSchema),
    notes: z.array(personNoteSchema),
  }),
});

export const createPersonBodySchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).optional(),
  companyId: z.number().int().positive().optional(),
});

export const createPersonResponseSchema = z.object({
  data: personSchema,
});

export const patchPersonBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    companyId: z.number().int().positive().nullable().optional(),
  })
  .refine((value) => value.name !== undefined || value.companyId !== undefined, {
    message: "At least one field must be provided",
  });

export const patchPersonResponseSchema = z.object({
  data: personSchema,
});
