import { describe, it, expect, beforeEach } from "vitest";
import { registerGetScheduledEmails } from "../../src/worker/routes/inbox/emails/get-scheduled";
import { setupTestDb, TEST_USER, TEST_USER_2, seedTestUser } from "../helpers/setup";
import { seedMailbox, seedScheduledEmail } from "../helpers/seed";
import { createTestApp, testRequest } from "../helpers/request";
import type { Hono } from "hono";
import type { AppRouteEnv } from "../../src/worker/routes/types";

function buildApp(user?: typeof TEST_USER | null) {
  return createTestApp(
    (app) => {
      registerGetScheduledEmails(app);
    },
    { prefix: "/api", user },
  );
}

let app: Hono<AppRouteEnv>;
let mailboxId: number;

describe("Scheduled Emails API", () => {
  beforeEach(async () => {
    await setupTestDb();
    app = buildApp();
    mailboxId = await seedMailbox();
  });

  describe("GET /api/scheduled", () => {
    it("returns empty list when no scheduled emails", async () => {
      const { status, json } = await testRequest(app, "GET", "/api/scheduled");
      expect(status).toBe(200);
      expect(json.data).toEqual([]);
    });

    it("returns pending scheduled emails", async () => {
      await seedScheduledEmail(mailboxId, { subject: "Later email" });
      await seedScheduledEmail(mailboxId, { subject: "Another one" });

      const { json } = await testRequest(app, "GET", "/api/scheduled");
      expect(json.data).toHaveLength(2);
    });

    it("excludes non-pending scheduled emails", async () => {
      await seedScheduledEmail(mailboxId, { subject: "Pending", status: "pending" });
      await seedScheduledEmail(mailboxId, { subject: "Sent", status: "sent" });
      await seedScheduledEmail(mailboxId, { subject: "Failed", status: "failed" });
      await seedScheduledEmail(mailboxId, { subject: "Cancelled", status: "cancelled" });

      const { json } = await testRequest(app, "GET", "/api/scheduled");
      expect(json.data).toHaveLength(1);
      expect(json.data[0].subject).toBe("Pending");
    });
  });

  describe("DELETE /api/scheduled/:id", () => {
    it("cancels a pending scheduled email", async () => {
      const id = await seedScheduledEmail(mailboxId, { subject: "Cancel me" });

      const { status, json } = await testRequest(
        app,
        "DELETE",
        `/api/scheduled/${id}`,
      );
      expect(status).toBe(200);
      expect(json.data.id).toBe(id);

      const { json: list } = await testRequest(app, "GET", "/api/scheduled");
      expect(list.data).toHaveLength(0);
    });

    it("returns 404 for already sent email", async () => {
      const id = await seedScheduledEmail(mailboxId, { status: "sent" });

      const { status } = await testRequest(
        app,
        "DELETE",
        `/api/scheduled/${id}`,
      );
      expect(status).toBe(404);
    });

    it("returns 404 for nonexistent id", async () => {
      const { status } = await testRequest(
        app,
        "DELETE",
        "/api/scheduled/99999",
      );
      expect(status).toBe(404);
    });

    it("returns 400 for invalid id", async () => {
      const { status } = await testRequest(
        app,
        "DELETE",
        "/api/scheduled/abc",
      );
      expect(status).toBe(400);
    });
  });

  describe("User isolation", () => {
    it("cannot see another user's scheduled emails", async () => {
      await seedScheduledEmail(mailboxId);

      await seedTestUser(TEST_USER_2);
      const app2 = buildApp(TEST_USER_2);
      const { json } = await testRequest(app2, "GET", "/api/scheduled");
      expect(json.data).toHaveLength(0);
    });

    it("cannot cancel another user's scheduled email", async () => {
      const id = await seedScheduledEmail(mailboxId);

      await seedTestUser(TEST_USER_2);
      const app2 = buildApp(TEST_USER_2);
      const { status } = await testRequest(
        app2,
        "DELETE",
        `/api/scheduled/${id}`,
      );
      expect(status).toBe(404);
    });
  });
});
