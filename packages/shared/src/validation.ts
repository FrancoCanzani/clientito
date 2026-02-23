import { z } from "zod/v4";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  orgName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createReleaseSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  version: z.string().max(50).optional(),
  contentMd: z.string().min(1),
  displayType: z.enum(["modal", "banner", "changelog"]).default("modal"),
  publishAt: z.number().optional(),
  unpublishAt: z.number().optional(),
  showOnce: z.boolean().default(true),
  targetTraits: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateReleaseSchema = createReleaseSchema.partial();

export const sdkConfigSchema = z.object({
  theme: z.record(z.string(), z.unknown()).default({}),
  position: z.string().default("bottom-right"),
  zIndex: z.number().default(99999),
  customCss: z.string().nullable().default(null),
});

export const createChecklistSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  targetTraits: z.record(z.string(), z.unknown()).optional(),
});

export const checklistItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  trackEvent: z.string().min(1).max(100),
  sortOrder: z.number().default(0),
});

export const createIntegrationSchema = z.object({
  type: z.enum(["github", "gitlab", "slack", "custom_webhook"]),
  config: z.record(z.string(), z.unknown()),
  isActive: z.boolean().default(true),
});

export const updateIntegrationSchema = createIntegrationSchema.partial();

export const sdkTrackEventSchema = z.object({
  type: z.enum(["view", "dismiss", "click", "checklist_complete"]),
  releaseId: z.string().min(1).optional(),
  checklistItemId: z.string().min(1).optional(),
  endUserId: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const sdkTrackEventsSchema = z.union([
  sdkTrackEventSchema,
  z.array(sdkTrackEventSchema).min(1).max(50),
]);
