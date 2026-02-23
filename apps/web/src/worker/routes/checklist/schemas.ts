import { z } from "zod/v4";
import { createChecklistSchema, checklistItemSchema } from "@releaselayer/shared";

export { checklistItemSchema };

export const createChecklistWithItemsSchema = createChecklistSchema.extend({
  isActive: z.boolean().optional(),
  items: z.array(checklistItemSchema).optional(),
});

export const updateChecklistSchema = createChecklistSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial();

export const updateChecklistItemSchema = checklistItemSchema.partial();
