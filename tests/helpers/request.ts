import { Hono } from "hono";
import { createDb } from "../../src/worker/db/client";
import type { AppRouteEnv } from "../../src/worker/routes/types";
import { env } from "cloudflare:workers";
import { TEST_USER } from "./setup";

/**
 * Creates a test Hono app that bypasses auth and injects a test user + db.
 * Usage: pass a function that registers routes on the app.
 */
export function createTestApp(
  registerRoutes: (app: Hono<AppRouteEnv>) => void,
  options?: { prefix?: string; user?: typeof TEST_USER | null },
): Hono<AppRouteEnv> {
  const app = new Hono<AppRouteEnv>();
  const testUser = options?.user === undefined ? TEST_USER : options.user;

  app.use("*", async (c, next) => {
    c.set("db", createDb(env.DB));
    if (testUser) {
      c.set("user", testUser as any);
      c.set("session", { id: "test-session" } as any);
    } else {
      c.set("user", null);
      c.set("session", null);
    }
    await next();
  });

  const sub = new Hono<AppRouteEnv>();
  registerRoutes(sub);

  const prefix = options?.prefix ?? "/api";
  app.route(prefix, sub);

  return app;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Helper to make test requests with less boilerplate.
 */
export async function testRequest(
  app: Hono<AppRouteEnv>,
  method: HttpMethod,
  path: string,
  options?: {
    body?: unknown;
    query?: Record<string, string>;
  },
) {
  const url = new URL(path, "http://localhost");
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  const init: RequestInit = { method };
  if (options?.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }

  const res = await app.request(url.pathname + url.search, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON response
  }
  return { res, json, text, status: res.status };
}
