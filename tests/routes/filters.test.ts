import { describe, it, expect, beforeEach } from "vitest";
import { registerGetFilters } from "../../src/worker/routes/filters/get-all";
import { registerCreateFilter } from "../../src/worker/routes/filters/post-create";
import { registerUpdateFilter } from "../../src/worker/routes/filters/put-update";
import { registerDeleteFilter } from "../../src/worker/routes/filters/delete";
import { setupTestDb, TEST_USER, TEST_USER_2, seedTestUser } from "../helpers/setup";
import { createTestApp, testRequest } from "../helpers/request";
import type { Hono } from "hono";
import type { AppRouteEnv } from "../../src/worker/routes/types";

const VALID_FILTER = {
  name: "Archive newsletters",
  description: "Auto-archive newsletter emails",
  actions: { archive: true, markRead: true },
};

function buildApp(user?: typeof TEST_USER | null) {
  return createTestApp(
    (app) => {
      registerGetFilters(app);
      registerCreateFilter(app);
      registerUpdateFilter(app);
      registerDeleteFilter(app);
    },
    { prefix: "/api", user },
  );
}

let app: Hono<AppRouteEnv>;

describe("Filters API", () => {
  beforeEach(async () => {
    await setupTestDb();
    app = buildApp();
  });

  // --- POST / ---
  describe("POST /api/", () => {
    it("creates a filter", async () => {
      const { status, json } = await testRequest(app, "POST", "/api", {
        body: VALID_FILTER,
      });
      expect(status).toBe(201);
      expect(json.data.name).toBe("Archive newsletters");
      expect(json.data.enabled).toBe(true);
      expect(json.data.id).toBeTypeOf("number");
    });

    it("rejects missing name", async () => {
      const { status } = await testRequest(app, "POST", "/api", {
        body: { description: "Test desc", actions: { archive: true } },
      });
      expect(status).toBe(400);
    });

    it("rejects missing actions", async () => {
      const { status } = await testRequest(app, "POST", "/api", {
        body: { name: "Test", description: "Test desc" },
      });
      expect(status).toBe(400);
    });
  });

  // --- GET / ---
  describe("GET /api/", () => {
    it("returns empty list initially", async () => {
      const { status, json } = await testRequest(app, "GET", "/api");
      expect(status).toBe(200);
      expect(json.data).toEqual([]);
    });

    it("returns created filters", async () => {
      await testRequest(app, "POST", "/api", { body: VALID_FILTER });
      await testRequest(app, "POST", "/api", {
        body: { ...VALID_FILTER, name: "Star important" },
      });

      const { json } = await testRequest(app, "GET", "/api");
      expect(json.data).toHaveLength(2);
    });
  });

  // --- PUT /:id ---
  describe("PUT /api/:id", () => {
    it("updates a filter", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: VALID_FILTER,
      });

      const { status, json } = await testRequest(
        app,
        "PUT",
        `/api/${created.data.id}`,
        {
          body: {
            name: "Updated name",
            actions: { archive: false },
          },
        },
      );
      expect(status).toBe(200);
      expect(json.data.name).toBe("Updated name");
    });

    it("returns 404 for nonexistent filter", async () => {
      const { status } = await testRequest(app, "PUT", "/api/99999", {
        body: {
          name: "Nope",
          actions: { archive: true },
        },
      });
      expect(status).toBe(404);
    });

    it("returns 400 for non-numeric id", async () => {
      const { status } = await testRequest(app, "PUT", "/api/abc", {
        body: {
          name: "Nope",
          actions: { archive: true },
        },
      });
      expect(status).toBe(400);
    });
  });

  // --- DELETE /:id ---
  describe("DELETE /api/:id", () => {
    it("deletes a filter", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: VALID_FILTER,
      });

      const { status } = await testRequest(
        app,
        "DELETE",
        `/api/${created.data.id}`,
      );
      expect(status).toBe(200);

      const { json: list } = await testRequest(app, "GET", "/api");
      expect(list.data).toHaveLength(0);
    });

    it("returns 404 for nonexistent filter", async () => {
      const { status } = await testRequest(app, "DELETE", "/api/99999");
      expect(status).toBe(404);
    });

    it("returns 400 for non-numeric id", async () => {
      const { status } = await testRequest(app, "DELETE", "/api/abc");
      expect(status).toBe(400);
    });

    it("returns 400 for negative id", async () => {
      const { status } = await testRequest(app, "DELETE", "/api/-5");
      expect(status).toBe(400);
    });
  });

  // --- User isolation ---
  describe("User isolation", () => {
    it("cannot see another user's filters", async () => {
      await testRequest(app, "POST", "/api", { body: VALID_FILTER });

      await seedTestUser(TEST_USER_2);
      const app2 = buildApp(TEST_USER_2);
      const { json } = await testRequest(app2, "GET", "/api");
      expect(json.data).toHaveLength(0);
    });

    it("cannot delete another user's filter", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: VALID_FILTER,
      });

      await seedTestUser(TEST_USER_2);
      const app2 = buildApp(TEST_USER_2);
      const { status } = await testRequest(
        app2,
        "DELETE",
        `/api/${created.data.id}`,
      );
      expect(status).toBe(404);
    });
  });
});
