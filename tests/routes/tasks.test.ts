import { describe, it, expect, beforeEach } from "vitest";
import { registerGetTasks } from "../../src/worker/routes/tasks/get";
import { registerPostTasks } from "../../src/worker/routes/tasks/post";
import { registerPatchTasks } from "../../src/worker/routes/tasks/patch";
import { registerDeleteTasks } from "../../src/worker/routes/tasks/delete";
import { setupTestDb, TEST_USER, TEST_USER_2, seedTestUser } from "../helpers/setup";
import { createTestApp, testRequest } from "../helpers/request";
import type { Hono } from "hono";
import type { AppRouteEnv } from "../../src/worker/routes/types";

function buildApp(user?: typeof TEST_USER | null) {
  return createTestApp(
    (app) => {
      registerGetTasks(app);
      registerPostTasks(app);
      registerPatchTasks(app);
      registerDeleteTasks(app);
    },
    { prefix: "/api", user },
  );
}

let app: Hono<AppRouteEnv>;

describe("Tasks API", () => {
  beforeEach(async () => {
    await setupTestDb();
    app = buildApp();
  });

  // --- POST / ---
  describe("POST /api/", () => {
    it("creates a task", async () => {
      const { status, json } = await testRequest(app, "POST", "/api", {
        body: { title: "Buy milk" },
      });
      expect(status).toBe(201);
      expect(json.data.title).toBe("Buy milk");
      expect(json.data.status).toBe("todo");
      expect(json.data.priority).toBe("low");
      expect(json.data.id).toBeTypeOf("number");
    });

    it("rejects empty title", async () => {
      const { status } = await testRequest(app, "POST", "/api", {
        body: { title: "" },
      });
      expect(status).toBe(400);
    });

    it("rejects missing title", async () => {
      const { status } = await testRequest(app, "POST", "/api", {
        body: {},
      });
      expect(status).toBe(400);
    });

    it("accepts optional fields", async () => {
      const { status, json } = await testRequest(app, "POST", "/api", {
        body: {
          title: "Deploy v2",
          description: "Ship it",
          priority: "high",
          status: "in_progress",
          dueAt: 1700000000000,
        },
      });
      expect(status).toBe(201);
      expect(json.data.priority).toBe("high");
      expect(json.data.status).toBe("in_progress");
      expect(json.data.description).toBe("Ship it");
      expect(json.data.dueAt).toBe(1700000000000);
    });

    it("rejects invalid priority", async () => {
      const { status } = await testRequest(app, "POST", "/api", {
        body: { title: "Test", priority: "mega-urgent" },
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
      expect(json.pagination.total).toBe(0);
    });

    it("returns created tasks", async () => {
      await testRequest(app, "POST", "/api", { body: { title: "Task 1" } });
      await testRequest(app, "POST", "/api", { body: { title: "Task 2" } });

      const { status, json } = await testRequest(app, "GET", "/api");
      expect(status).toBe(200);
      expect(json.data).toHaveLength(2);
      expect(json.pagination.total).toBe(2);
    });

    it("supports limit and offset", async () => {
      await testRequest(app, "POST", "/api", { body: { title: "Task 1" } });
      await testRequest(app, "POST", "/api", { body: { title: "Task 2" } });
      await testRequest(app, "POST", "/api", { body: { title: "Task 3" } });

      const { json } = await testRequest(app, "GET", "/api", {
        query: { limit: "2", offset: "0" },
      });
      expect(json.data).toHaveLength(2);
      expect(json.pagination.total).toBe(3);

      const { json: json2 } = await testRequest(app, "GET", "/api", {
        query: { limit: "2", offset: "2" },
      });
      expect(json2.data).toHaveLength(1);
    });

    it("filters by status", async () => {
      await testRequest(app, "POST", "/api", {
        body: { title: "Todo", status: "todo" },
      });
      await testRequest(app, "POST", "/api", {
        body: { title: "Done", status: "done" },
      });

      const { json } = await testRequest(app, "GET", "/api", {
        query: { status: "done" },
      });
      expect(json.data).toHaveLength(1);
      expect(json.data[0].title).toBe("Done");
    });
  });

  // --- PATCH /:id ---
  describe("PATCH /api/:id", () => {
    it("updates a task", async () => {
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

    it("sets completedAt when marking done", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: { title: "Test" },
      });

      const { json } = await testRequest(
        app,
        "PATCH",
        `/api/${created.data.id}`,
        { body: { status: "done" } },
      );
      expect(json.data.status).toBe("done");
      expect(json.data.completedAt).toBeTypeOf("number");
    });

    it("clears completedAt when un-marking done", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: { title: "Test", status: "done" },
      });

      const { json } = await testRequest(
        app,
        "PATCH",
        `/api/${created.data.id}`,
        { body: { status: "todo" } },
      );
      expect(json.data.completedAt).toBeNull();
    });

    it("returns 404 for nonexistent task", async () => {
      const { status } = await testRequest(app, "PATCH", "/api/99999", {
        body: { title: "Nope" },
      });
      expect(status).toBe(404);
    });

    it("returns 400 for invalid id", async () => {
      const { status } = await testRequest(app, "PATCH", "/api/abc", {
        body: { title: "Nope" },
      });
      expect(status).toBe(400);
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

  // --- DELETE /:id ---
  describe("DELETE /api/:id", () => {
    it("deletes a task", async () => {
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

    it("returns 404 for nonexistent task", async () => {
      const { status } = await testRequest(app, "DELETE", "/api/99999");
      expect(status).toBe(404);
    });

    it("returns 400 for invalid id", async () => {
      const { status } = await testRequest(app, "DELETE", "/api/abc");
      expect(status).toBe(400);
    });
  });

  // --- Isolation between users ---
  describe("User isolation", () => {
    it("cannot see another user's tasks", async () => {
      await testRequest(app, "POST", "/api", {
        body: { title: "User 1 task" },
      });

      await seedTestUser(TEST_USER_2);
      const app2 = buildApp(TEST_USER_2);
      const { json } = await testRequest(app2, "GET", "/api");
      expect(json.data).toHaveLength(0);
    });

    it("cannot delete another user's task", async () => {
      const { json: created } = await testRequest(app, "POST", "/api", {
        body: { title: "User 1 task" },
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
