import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { registerGetSync } from "../../src/worker/routes/inbox/sync/get";
import type { AppRouteEnv } from "../../src/worker/routes/types";
import { createTestApp, testRequest } from "../helpers/request";
import { seedAccount } from "../helpers/seed";
import { getDb, setupTestDb, TEST_USER } from "../helpers/setup";

function buildApp(user?: typeof TEST_USER | null) {
  return createTestApp(
    (app) => {
      registerGetSync(app);
    },
    { prefix: "/api/inbox/sync", user },
  );
}

let app: Hono<AppRouteEnv>;

describe("Sync status API", () => {
  beforeEach(async () => {
    await setupTestDb();
    app = buildApp();
  });

  it("returns ready_to_sync after Google is linked even before settings loads", async () => {
    const db = getDb();
    await seedAccount({ id: "acct-linked-google" });

    const { status, json } = await testRequest(app, "GET", "/api/inbox/sync/status");

    expect(status).toBe(200);
    expect(json.data.state).toBe("ready_to_sync");

    const mailboxes = await db.query.mailboxes.findMany({
      where: (mailboxes, { eq }) => eq(mailboxes.userId, TEST_USER.id),
    });
    expect(mailboxes).toHaveLength(1);
    expect(mailboxes[0]?.accountId).toBe("acct-linked-google");
  });
});
