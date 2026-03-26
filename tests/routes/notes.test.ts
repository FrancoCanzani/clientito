import { describe, it, expect, beforeEach } from "vitest";
import { registerGetNotes } from "../../src/worker/routes/notes/get";
import { registerPostNotes } from "../../src/worker/routes/notes/post";
import { registerPatchNotes } from "../../src/worker/routes/notes/patch";
import { registerDeleteNotes } from "../../src/worker/routes/notes/delete";
import { setupTestDb, TEST_USER, TEST_USER_2, seedTestUser } from "../helpers/setup";
import { createTestApp, testRequest } from "../helpers/request";
import type { Hono } from "hono";
import type { AppRouteEnv } from "../../src/worker/routes/types";

function buildApp(user?: typeof TEST_USER | null) {
  return createTestApp(
    (app) => {
      registerGetNotes(app);
      registerPostNotes(app);
      registerPatchNotes(app);
      registerDeleteNotes(app);
    },
    { prefix: "/api", user },
  );
}

let app: Hono<AppRouteEnv>;

describe("Notes API", () => {
  beforeEach(async () => {
    await setupTestDb();
    app = buildApp();
  });

  describe("POST /api/", () => {
    it("creates a note with default title", async () => {
      const { status, json } = await testRequest(app, "POST", "/api", {
        body: { content: "Hello world" },
      });
      expect(status).toBe(201);
      expect(json.data.title).toBe("Untitled note");
      expect(json.data.content).toBe("Hello world");
    });

    it("creates a note with custom title", async () => {
      const { status, json } = await testRequest(app, "POST", "/api", {
        body: { title: "My note", content: "Content here" },
      });
      expect(status).toBe(201);
      expect(json.data.title).toBe("My note");
    });

    it("creates a note with empty content", async () => {
      const { status, json } = await testRequest(app, "POST", "/api", {
        body: {},
      });
      expect(status).toBe(201);
      expect(json.data.content).toBe("");
    });
  });

  describe("GET /api/", () => {
    it("returns empty list initially", async () => {
      const { status, json } = await testRequest(app, "GET", "/api");
      expect(status).toBe(200);
      expect(json.data).toEqual([]);
    });

    it("returns created notes", async () => {
      await testRequest(app, "POST", "/api", { body: { title: "Note 1" } });
      await testRequest(app, "POST", "/api", { body: { title: "Note 2" } });

      const { json } = await testRequest(app, "GET", "/api");
      expect(json.data).toHaveLength(2);
    });

    it("supports limit and offset", async () => {
      for (let i = 0; i < 5; i++) {
        await testRequest(app, "POST", "/api", { body: { title: `Note ${i}` } });
      }

      const { json } = await testRequest(app, "GET", "/api", {
        query: { limit: "2", offset: "0" },
      });
      expect(json.data).toHaveLength(2);
    });
  });

  describe("PATCH /api/:id", () => {
    it("updates a note title", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: { title: "Original" },
      });

      const { status, json } = await testRequest(
        app,
        "PATCH",
        `/api/${created.data.id}`,
        { body: { title: "Updated" } },
      );
      expect(status).toBe(200);
      expect(json.data.title).toBe("Updated");
    });

    it("updates note content", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: { content: "Original" },
      });

      const { json } = await testRequest(
        app,
        "PATCH",
        `/api/${created.data.id}`,
        { body: { content: "Updated content" } },
      );
      expect(json.data.content).toBe("Updated content");
    });

    it("pins a note", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: { title: "Pin me" },
      });

      const { json } = await testRequest(
        app,
        "PATCH",
        `/api/${created.data.id}`,
        { body: { isPinned: true } },
      );
      expect(json.data.isPinned).toBe(true);
    });

    it("returns 404 for nonexistent note", async () => {
      const { status } = await testRequest(app, "PATCH", "/api/99999", {
        body: { title: "Nope" },
      });
      expect(status).toBe(404);
    });

    it("rejects empty body", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: { title: "Test" },
      });
      const { status } = await testRequest(
        app,
        "PATCH",
        `/api/${created.data.id}`,
        { body: {} },
      );
      expect(status).toBe(400);
    });
  });

  describe("DELETE /api/:id", () => {
    it("deletes a note", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: { title: "To delete" },
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

    it("returns 404 for nonexistent note", async () => {
      const { status } = await testRequest(app, "DELETE", "/api/99999");
      expect(status).toBe(404);
    });
  });

  describe("User isolation", () => {
    it("cannot see another user's notes", async () => {
      await testRequest(app, "POST", "/api", { body: { title: "Secret" } });

      await seedTestUser(TEST_USER_2);
      const app2 = buildApp(TEST_USER_2);
      const { json } = await testRequest(app2, "GET", "/api");
      expect(json.data).toHaveLength(0);
    });

    it("cannot delete another user's note", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: { title: "User 1 note" },
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
