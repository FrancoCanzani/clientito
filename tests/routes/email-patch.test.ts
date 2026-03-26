import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerPatchEmail } from "../../src/worker/routes/inbox/emails/patch";
import { registerBatchPatchEmails } from "../../src/worker/routes/inbox/emails/patch-batch";
import { setupTestDb, TEST_USER } from "../helpers/setup";
import { seedEmail, seedMailbox, resetEmailCounter } from "../helpers/seed";
import { createTestApp, testRequest } from "../helpers/request";
import type { Hono } from "hono";
import type { AppRouteEnv } from "../../src/worker/routes/types";

vi.mock("../../src/worker/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/worker/lib/email")>();
  return {
    ...actual,
    createEmailProvider: vi.fn().mockResolvedValue({
      modifyLabels: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

function buildApp() {
  return createTestApp(
    (app) => {
      registerPatchEmail(app);
      registerBatchPatchEmails(app);
    },
    { prefix: "/api" },
  );
}

let app: Hono<AppRouteEnv>;

describe("Email Patch API", () => {
  beforeEach(async () => {
    await setupTestDb();
    resetEmailCounter();
    app = buildApp();
  });

  describe("PATCH /api/:emailId", () => {
    it("marks an email as read", async () => {
      const mbId = await seedMailbox();
      const emailId = await seedEmail({ mailboxId: mbId, isRead: false, labelIds: ["INBOX"] });

      const { status, json } = await testRequest(
        app,
        "PATCH",
        `/api/${emailId}`,
        { body: { isRead: true } },
      );
      expect(status).toBe(200);
      expect(json.data.isRead).toBe(true);
    });

    it("archives an email", async () => {
      const mbId = await seedMailbox();
      const emailId = await seedEmail({ mailboxId: mbId, labelIds: ["INBOX"] });

      const { status, json } = await testRequest(
        app,
        "PATCH",
        `/api/${emailId}`,
        { body: { archived: true } },
      );
      expect(status).toBe(200);
      expect(json.data.archived).toBe(true);
    });

    it("stars an email", async () => {
      const mbId = await seedMailbox();
      const emailId = await seedEmail({ mailboxId: mbId, labelIds: ["INBOX"] });

      const { json } = await testRequest(
        app,
        "PATCH",
        `/api/${emailId}`,
        { body: { starred: true } },
      );
      expect(json.data.starred).toBe(true);
    });

    it("snoozes an email", async () => {
      const mbId = await seedMailbox();
      const emailId = await seedEmail({ mailboxId: mbId, labelIds: ["INBOX"] });
      const future = Date.now() + 86400000;

      const { json } = await testRequest(
        app,
        "PATCH",
        `/api/${emailId}`,
        { body: { snoozedUntil: future } },
      );
      expect(json.data.snoozedUntil).toBe(future);
    });

    it("returns 404 for nonexistent email", async () => {
      const { status } = await testRequest(app, "PATCH", "/api/99999", {
        body: { isRead: true },
      });
      expect(status).toBe(404);
    });

    it("returns 400 for invalid id", async () => {
      const { status } = await testRequest(app, "PATCH", "/api/abc", {
        body: { isRead: true },
      });
      expect(status).toBe(400);
    });
  });

  describe("POST /api/batch", () => {
    it("batch marks emails as read", async () => {
      const mbId = await seedMailbox();
      const id1 = await seedEmail({ mailboxId: mbId, isRead: false, labelIds: ["INBOX"] });
      const id2 = await seedEmail({ mailboxId: mbId, isRead: false, labelIds: ["INBOX"] });

      const { status, json } = await testRequest(app, "POST", "/api/batch", {
        body: { emailIds: [id1, id2], isRead: true },
      });
      expect(status).toBe(200);
      expect(json.data).toHaveLength(2);
      expect(json.data.every((d: any) => d.isRead === true)).toBe(true);
    });

    it("batch archives emails", async () => {
      const mbId = await seedMailbox();
      const id1 = await seedEmail({ mailboxId: mbId, labelIds: ["INBOX"] });
      const id2 = await seedEmail({ mailboxId: mbId, labelIds: ["INBOX"] });

      const { status, json } = await testRequest(app, "POST", "/api/batch", {
        body: { emailIds: [id1, id2], archived: true },
      });
      expect(status).toBe(200);
      expect(json.data.every((d: any) => d.archived === true)).toBe(true);
    });

    it("returns 404 for nonexistent emails", async () => {
      const { status } = await testRequest(app, "POST", "/api/batch", {
        body: { emailIds: [99998, 99999], isRead: true },
      });
      expect(status).toBe(404);
    });

    it("rejects empty emailIds", async () => {
      const { status } = await testRequest(app, "POST", "/api/batch", {
        body: { emailIds: [], isRead: true },
      });
      expect(status).toBe(400);
    });
  });
});
