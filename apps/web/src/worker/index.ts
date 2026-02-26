import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "../../auth";
import { authMiddleware } from "./auth/middleware";
import { createDb } from "./db/client";
import { runScheduledIncrementalSync } from "./lib/gmail";
import classifyRoutes from "./routes/classify/router";
import contactsRoutes from "./routes/contacts/router";
import customersRoutes from "./routes/customers/router";
import emailsRoutes from "./routes/emails/router";
import healthRoutes from "./routes/health/router";
import orgRoutes from "./routes/org/router";
import remindersRoutes from "./routes/reminders/router";
import syncRoutes from "./routes/sync/router";
import type { AppRouteEnv } from "./routes/types";

const app = new Hono<AppRouteEnv>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin || "http://localhost:5173",
    credentials: true,
  })
);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

app.use("*", authMiddleware);

app.all("/api/auth/*", async (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

app.route("/api/health", healthRoutes);
app.route("/api/orgs", orgRoutes);
app.route("/api/sync", syncRoutes);
app.route("/api/classify", classifyRoutes);
app.route("/api/contacts", contactsRoutes);
app.route("/api/customers", customersRoutes);
app.route("/api/emails", emailsRoutes);
app.route("/api/reminders", remindersRoutes);

async function handleScheduledSync(env: Env) {
  const db = createDb(env.DB);
  await runScheduledIncrementalSync(db, env);
}

export default {
  fetch: app.fetch,
  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledSync(env));
  },
};
