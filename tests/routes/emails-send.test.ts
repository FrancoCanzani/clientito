import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerPostEmail } from "../../src/worker/routes/inbox/emails/post";
import { setupTestDb, TEST_USER, TEST_USER_2, seedTestUser } from "../helpers/setup";
import { seedMailbox } from "../helpers/seed";
import { createTestApp, testRequest } from "../helpers/request";
import type { Hono } from "hono";
import type { AppRouteEnv } from "../../src/worker/routes/types";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  syncMessageIds: vi.fn(),
  getAttachmentContent: vi.fn(),
}));

vi.mock("../../src/worker/lib/email", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/worker/lib/email")
  >();
  return {
    ...actual,
    createEmailProvider: vi.fn().mockResolvedValue({
      send: mocks.send,
      syncMessageIds: mocks.syncMessageIds,
    }),
  };
});

vi.mock("../../src/worker/routes/inbox/emails/internal/storage", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/worker/routes/inbox/emails/internal/storage")
  >();
  return {
    ...actual,
    getAttachmentContent: mocks.getAttachmentContent,
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
    mocks.send.mockReset();
    mocks.send.mockResolvedValue({
      providerMessageId: "gmail-sent-1",
      threadId: "thread-sent-1",
    });
    mocks.syncMessageIds.mockReset();
    mocks.syncMessageIds.mockResolvedValue(undefined);
    mocks.getAttachmentContent.mockReset();
    mocks.getAttachmentContent.mockResolvedValue(new ArrayBuffer(0));
  });

  it("sends with the explicit mailbox when mailboxId is provided", async () => {
    await seedMailbox({ email: "first@gmail.com" });
    const mailboxB = await seedMailbox({ email: "second@gmail.com" });

    const { status } = await testRequest(app, "POST", "/api/send", {
      body: {
        mailboxId: mailboxB,
        to: "hello@example.com",
        subject: "Test",
        body: "<p>Hello</p>",
      },
    });

    expect(status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(
      "second@gmail.com",
      expect.objectContaining({
        to: "hello@example.com",
        subject: "Test",
      }),
    );
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("falls back to the only mailbox when the user has one account", async () => {
    const mailboxId = await seedMailbox({ email: "solo@gmail.com" });

    const { status } = await testRequest(app, "POST", "/api/send", {
      body: {
        to: "hello@example.com",
        subject: "Test",
        body: "<p>Hello</p>",
      },
    });

    expect(status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(
      "solo@gmail.com",
      expect.anything(),
    );
  });

  it("requires sender selection when multiple mailboxes exist and mailboxId is omitted", async () => {
    await seedMailbox({ email: "first@gmail.com" });
    await seedMailbox({ email: "second@gmail.com" });

    const { status, json } = await testRequest(app, "POST", "/api/send", {
      body: {
        to: "hello@example.com",
        subject: "Test",
        body: "<p>Hello</p>",
      },
    });

    expect(status).toBe(400);
    expect(json.error).toBe("Select a sender account before sending.");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects mailbox ids that do not belong to the current user", async () => {
    await seedTestUser(TEST_USER_2);
    const otherMailboxId = await seedMailbox({
      userId: TEST_USER_2.id,
      email: "other@gmail.com",
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
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects attachment keys outside the current user's namespace", async () => {
    await seedMailbox({ email: "solo@gmail.com" });

    const { status, json } = await testRequest(app, "POST", "/api/send", {
      body: {
        to: "hello@example.com",
        subject: "Test",
        body: "<p>Hello</p>",
        attachments: [
          {
            key: `attachments/${TEST_USER_2.id}/leaked/file.pdf`,
            filename: "file.pdf",
            mimeType: "application/pdf",
          },
        ],
      },
    });

    expect(status).toBe(403);
    expect(json.error).toBe("Forbidden attachment key");
    expect(mocks.getAttachmentContent).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
