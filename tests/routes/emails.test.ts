import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerGetAllEmails } from "../../src/worker/routes/inbox/emails/get-all";
import { registerGetEmailThread } from "../../src/worker/routes/inbox/emails/get-thread";
import { setupTestDb, TEST_USER, TEST_USER_2, seedTestUser } from "../helpers/setup";
import { seedEmail, seedMailbox, resetEmailCounter } from "../helpers/seed";
import { createTestApp, testRequest } from "../helpers/request";
import type { Hono } from "hono";
import type { AppRouteEnv } from "../../src/worker/routes/types";

// Mock the sync function so GET / doesn't try to hit Gmail
vi.mock("../../src/worker/lib/email/providers/google/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/worker/lib/email/providers/google/sync")>();
  return {
    ...actual,
    catchUpAllMailboxes: vi.fn().mockResolvedValue(undefined),
    catchUpMailboxOnDemand: vi.fn().mockResolvedValue({ status: "skipped" }),
  };
});

function buildApp(user?: typeof TEST_USER | null) {
  return createTestApp(
    (app) => {
      registerGetAllEmails(app);
      registerGetEmailThread(app);
    },
    { prefix: "/api", user },
  );
}

let app: Hono<AppRouteEnv>;

describe("Emails API", () => {
  beforeEach(async () => {
    await setupTestDb();
    resetEmailCounter();
    app = buildApp();
  });

  // --- GET / (list) ---
  describe("GET /api/", () => {
    it("returns empty list when no emails", async () => {
      const { status, json } = await testRequest(app, "GET", "/api", {
        query: { view: "inbox" },
      });
      expect(status).toBe(200);
      expect(json.data).toEqual([]);
    });

    it("returns inbox emails", async () => {
      await seedEmail({ subject: "Hello", labelIds: ["INBOX"] });
      await seedEmail({ subject: "Sent msg", labelIds: ["SENT"] });

      const { json } = await testRequest(app, "GET", "/api", {
        query: { view: "inbox" },
      });
      expect(json.data).toHaveLength(1);
      expect(json.data[0].subject).toBe("Hello");
    });

    it("returns sent emails", async () => {
      await seedEmail({ subject: "Inbox msg", labelIds: ["INBOX"] });
      await seedEmail({ subject: "Sent msg", labelIds: ["SENT"] });

      const { json } = await testRequest(app, "GET", "/api", {
        query: { view: "sent" },
      });
      expect(json.data).toHaveLength(1);
      expect(json.data[0].subject).toBe("Sent msg");
    });

    it("returns starred emails", async () => {
      await seedEmail({ subject: "Starred", labelIds: ["INBOX", "STARRED"] });
      await seedEmail({ subject: "Normal", labelIds: ["INBOX"] });

      const { json } = await testRequest(app, "GET", "/api", {
        query: { view: "starred" },
      });
      expect(json.data).toHaveLength(1);
      expect(json.data[0].subject).toBe("Starred");
    });

    it("respects limit and offset", async () => {
      for (let i = 0; i < 5; i++) {
        await seedEmail({ subject: `Email ${i}`, labelIds: ["INBOX"] });
      }

      const { json } = await testRequest(app, "GET", "/api", {
        query: { view: "inbox", limit: "2", offset: "0" },
      });
      expect(json.data).toHaveLength(2);
      expect(json.pagination.hasMore).toBe(true);
    });

    it("filters by mailboxId", async () => {
      const mbId = await seedMailbox();
      await seedEmail({ subject: "In mailbox", labelIds: ["INBOX"], mailboxId: mbId });
      await seedEmail({ subject: "No mailbox", labelIds: ["INBOX"] });

      const { json } = await testRequest(app, "GET", "/api", {
        query: { view: "inbox", mailboxId: String(mbId) },
      });
      expect(json.data).toHaveLength(1);
      expect(json.data[0].subject).toBe("In mailbox");
    });

    it("filters by isRead", async () => {
      await seedEmail({ subject: "Unread", isRead: false, labelIds: ["INBOX"] });
      await seedEmail({ subject: "Read", isRead: true, labelIds: ["INBOX"] });

      const { json } = await testRequest(app, "GET", "/api", {
        query: { view: "inbox", isRead: "false" },
      });
      expect(json.data).toHaveLength(1);
      expect(json.data[0].subject).toBe("Unread");
    });

    it("searches by subject", async () => {
      await seedEmail({ subject: "Meeting tomorrow", labelIds: ["INBOX"] });
      await seedEmail({ subject: "Invoice #123", labelIds: ["INBOX"] });

      const { json } = await testRequest(app, "GET", "/api", {
        query: { view: "inbox", search: "meeting" },
      });
      expect(json.data).toHaveLength(1);
      expect(json.data[0].subject).toBe("Meeting tomorrow");
    });

    it("hides snoozed emails from inbox", async () => {
      const future = Date.now() + 86400000;
      await seedEmail({
        subject: "Snoozed",
        labelIds: ["INBOX"],
        snoozedUntil: future,
      });
      await seedEmail({ subject: "Normal", labelIds: ["INBOX"] });

      const { json } = await testRequest(app, "GET", "/api", {
        query: { view: "inbox" },
      });
      expect(json.data).toHaveLength(1);
      expect(json.data[0].subject).toBe("Normal");
    });

    it("shows snoozed emails in snoozed view", async () => {
      const future = Date.now() + 86400000;
      await seedEmail({
        subject: "Snoozed",
        labelIds: ["INBOX"],
        snoozedUntil: future,
      });

      const { json } = await testRequest(app, "GET", "/api", {
        query: { view: "snoozed" },
      });
      expect(json.data).toHaveLength(1);
      expect(json.data[0].subject).toBe("Snoozed");
    });

    it("rejects invalid view", async () => {
      const { status } = await testRequest(app, "GET", "/api", {
        query: { view: "drafts" },
      });
      expect(status).toBe(400);
    });
  });

  // --- GET /thread/:threadId ---
  describe("GET /api/thread/:threadId", () => {
    it("returns emails in a thread", async () => {
      await seedEmail({ threadId: "t-1", subject: "First", labelIds: ["INBOX"] });
      await seedEmail({ threadId: "t-1", subject: "Reply", labelIds: ["INBOX"] });
      await seedEmail({ threadId: "t-2", subject: "Other", labelIds: ["INBOX"] });

      const { status, json } = await testRequest(app, "GET", "/api/thread/t-1");
      expect(status).toBe(200);
      expect(json.data).toHaveLength(2);
    });

    it("returns empty for nonexistent thread", async () => {
      const { status, json } = await testRequest(
        app,
        "GET",
        "/api/thread/nonexistent",
      );
      expect(status).toBe(200);
      expect(json.data).toHaveLength(0);
    });
  });

  // --- User isolation ---
  describe("User isolation", () => {
    it("cannot see another user's emails", async () => {
      await seedEmail({ subject: "Secret", labelIds: ["INBOX"] });

      await seedTestUser(TEST_USER_2);
      const app2 = buildApp(TEST_USER_2);
      const { json } = await testRequest(app2, "GET", "/api", {
        query: { view: "inbox" },
      });
      expect(json.data).toHaveLength(0);
    });
  });
});
