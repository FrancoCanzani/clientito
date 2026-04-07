import { z } from "zod";

export const emailFolderSchema = z.enum([
  "starred",
  "sent",
  "archived",
  "spam",
  "trash",
]);

export const inboxLabelSchema = z.enum(["important"]);

export const emailIdParamSchema = z.string().regex(/^\d+$/);

export const folderParamsSchema = z.object({
  folder: emailFolderSchema,
});

export const labelParamsSchema = z.object({
  label: inboxLabelSchema,
});

export const emailIdParamsSchema = z.object({
  emailId: emailIdParamSchema,
});

export const folderEmailParamsSchema = folderParamsSchema.extend({
  emailId: emailIdParamSchema,
});

export const labelEmailParamsSchema = labelParamsSchema.extend({
  emailId: emailIdParamSchema,
});
