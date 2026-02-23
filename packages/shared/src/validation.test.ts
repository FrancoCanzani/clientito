import { describe, expect, it } from "bun:test";
import {
  createProjectSchema,
  createReleaseSchema,
  createIntegrationSchema,
  PLAN_LIMITS,
  sdkTrackEventSchema,
  sdkTrackEventsSchema,
} from "./index";

describe("createProjectSchema", () => {
  it("accepts a valid slug", () => {
    const parsed = createProjectSchema.safeParse({
      name: "Acme",
      slug: "acme-project",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid slug", () => {
    const parsed = createProjectSchema.safeParse({
      name: "Acme",
      slug: "Acme Project!",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("createReleaseSchema", () => {
  it("requires markdown content", () => {
    const parsed = createReleaseSchema.safeParse({
      title: "Release 1",
      slug: "release-1",
      contentMd: "",
      displayType: "modal",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("sdkTrackEventsSchema", () => {
  it("accepts a single valid event", () => {
    const parsed = sdkTrackEventSchema.safeParse({
      type: "view",
      endUserId: "user_123",
      releaseId: "release_1",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty event batch", () => {
    const parsed = sdkTrackEventsSchema.safeParse([]);
    expect(parsed.success).toBe(false);
  });
});

describe("PLAN_LIMITS", () => {
  it("keeps project limits increasing by plan tier", () => {
    expect(PLAN_LIMITS.free.projectsLimit).toBeLessThan(PLAN_LIMITS.starter.projectsLimit);
    expect(PLAN_LIMITS.starter.projectsLimit).toBeLessThan(PLAN_LIMITS.growth.projectsLimit);
    expect(PLAN_LIMITS.growth.projectsLimit).toBeLessThan(PLAN_LIMITS.pro.projectsLimit);
  });
});

describe("createIntegrationSchema", () => {
  it("accepts supported integration types", () => {
    const parsed = createIntegrationSchema.safeParse({
      type: "slack",
      config: { webhookUrl: "https://example.com/hook" },
      isActive: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unsupported integration types", () => {
    const parsed = createIntegrationSchema.safeParse({
      type: "discord",
      config: {},
    });
    expect(parsed.success).toBe(false);
  });
});
