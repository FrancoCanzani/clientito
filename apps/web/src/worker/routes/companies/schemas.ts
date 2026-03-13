import { z } from "zod";

export const errorResponseSchema = z.object({ error: z.string() });

export const companyIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const getCompaniesQuerySchema = z.object({
  q: z.string().trim().optional(),
});

export const companySchema = z.object({
  id: z.number(),
  domain: z.string(),
  name: z.string().nullable(),
  industry: z.string().nullable(),
  website: z.string().nullable(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
  createdAt: z.number(),
});

export const companyListItemSchema = companySchema.extend({
  peopleCount: z.number(),
});

export const companyPersonSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  title: z.string().nullable(),
  linkedin: z.string().nullable(),
  companyId: z.number().nullable(),
  lastContactedAt: z.number().nullable(),
  createdAt: z.number(),
});

export const companyTaskSchema = z.object({
  id: z.number(),
  title: z.string(),
  dueAt: z.number().nullable(),
  done: z.boolean(),
  personId: z.number().nullable(),
  companyId: z.number().nullable(),
  createdAt: z.number(),
});

export const companyNoteSchema = z.object({
  id: z.number(),
  content: z.string(),
  personId: z.number().nullable(),
  companyId: z.number().nullable(),
  createdAt: z.number(),
});

export const listCompaniesResponseSchema = z.object({
  data: z.array(companyListItemSchema),
});

export const getCompanyResponseSchema = z.object({
  data: z.object({
    company: companySchema,
    people: z.array(companyPersonSchema),
    tasks: z.array(companyTaskSchema),
    notes: z.array(companyNoteSchema),
  }),
});

export const patchCompanyBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    industry: z.string().trim().nullable().optional(),
    website: z.string().trim().nullable().optional(),
    description: z.string().trim().nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.industry !== undefined ||
      value.website !== undefined ||
      value.description !== undefined,
    { message: "At least one field must be provided" },
  );

export const patchCompanyResponseSchema = z.object({
  data: companySchema,
});
