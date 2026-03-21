import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerPostEmail } from "../../src/worker/routes/emails/post";
import { setupTestDb, TEST_USER, TEST_USER_2, seedTestUser } from "../helpers/setup";
import { seedMailbox } from "../helpers/seed";
import { createTestApp, testRequest } from "../helpers/request";
import type { Hono } from "hono";
import type { AppRouteEnv } from "../../src/worker/routes/types";

const mocks = vi.hoisted(() => ({
  sendGmailMessage: vi.fn(),
  syncGmailMessageIds: vi.fn(),
}));

vi.mock("../../src/worker/lib/gmail/mailbox", () => ({
  fetchAttachmentFromR2: vi.fn(),
  sendGmailMessage: mocks.sendGmailMessage,
}));

vi.mock("../../src/worker/lib/gmail/sync", () => ({
  syncGmailMessageIds: mocks.syncGmailMessageIds,
}));

vi.mock("../../src/worker/lib/gmail/client", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/worker/lib/gmail/client")
  >();
  return {
    ...actual,
    sleep: vi.fn().mockResolvedValue(undefined),
  };
});

function buildApp(user?: typeof TEST_USER | null) {
  return createTestApp(
    (app) => {
      registerPostEmail(app);
    },
    { prefix: "/api", user },
  );
}

let app: Hono<AppRouteEnv>;

describe("POST /api/send", () => {
  beforeEach(async () => {
    await setupTestDb();
    app = buildApp();
    mocks.sendGmailMessage.mockReset();
    mocks.sendGmailMessage.mockResolvedValue({
      gmailId: "gmail-sent-1",
      threadId: "thread-sent-1",
    });
    mocks.syncGmailMessageIds.mockReset();
    mocks.syncGmailMessageIds.mockResolvedValue(undefined);
  });

  it("sends with the explicit mailbox when mailboxId is provided", async () => {
    const mailboxA = await seedMailbox({ gmailEmail: "first@gmail.com" });
    const mailboxB = await seedMailbox({ gmailEmail: "second@gmail.com" });

    const { status } = await testRequest(app, "POST", "/api/send", {
      body: {
        mailboxId: mailboxB,
        to: "hello@example.com",
        subject: "Test",
        body: "<p>Hello</p>",
      },
    });

    expect(status).toBe(200);
    expect(mocks.sendGmailMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      mailboxB,
      "second@gmail.com",
      expect.objectContaining({
        to: "hello@example.com",
        subject: "Test",
      }),
    );
    expect(mocks.sendGmailMessage).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      mailboxA,
      expect.anything(),
      expect.anything(),
    );
  });

  it("falls back to the only mailbox when the user has one account", async () => {
    const mailboxId = await seedMailbox({ gmailEmail: "solo@gmail.com" });

    const { status } = await testRequest(app, "POST", "/api/send", {
      body: {
        to: "hello@example.com",
        subject: "Test",
        body: "<p>Hello</p>",
      },
    });

    expect(status).toBe(200);
    expect(mocks.sendGmailMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      mailboxId,
      "solo@gmail.com",
      expect.anything(),
    );
  });

  it("requires sender selection when multiple mailboxes exist and mailboxId is omitted", async () => {
    await seedMailbox({ gmailEmail: "first@gmail.com" });
    await seedMailbox({ gmailEmail: "second@gmail.com" });

    const { status, json } = await testRequest(app, "POST", "/api/send", {
      body: {
        to: "hello@example.com",
        subject: "Test",
        body: "<p>Hello</p>",
      },
    });

    expect(status).toBe(400);
    expect(json.error).toBe("Select a sender account before sending.");
    expect(mocks.sendGmailMessage).not.toHaveBeenCalled();
  });

  it("rejects mailbox ids that do not belong to the current user", async () => {
    await seedTestUser(TEST_USER_2);
    const otherMailboxId = await seedMailbox({
      userId: TEST_USER_2.id,
      gmailEmail: "other@gmail.com",
    });

    const { status, json } = await testRequest(app, "POST", "/api/send", {
      body: {
        mailboxId: otherMailboxId,
        to: "hello@example.com",
        subject: "Test",
        body: "<p>Hello</p>",
      },
    });

    expect(status).toBe(404);
    expect(json.error).toBe("Selected sender account not found.");
    expect(mocks.sendGmailMessage).not.toHaveBeenCalled();
  });
});
