import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "./auth/middleware";
import { createAuth } from "./auth/server";
import { createDb } from "./db/client";
import { runScheduledIncrementalSync } from "./lib/gmail";
import companiesRoutes from "./routes/companies/router";
import dashboardRoutes from "./routes/dashboard/router";
import emailsRoutes from "./routes/emails/router";
import healthRoutes from "./routes/health/router";
import notesRoutes from "./routes/notes/router";
import peopleRoutes from "./routes/people/router";
import syncRoutes from "./routes/sync/router";
import tasksRoutes from "./routes/tasks/router";
import type { AppRouteEnv } from "./routes/types";

const app = new Hono<AppRouteEnv>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin || "http://localhost:5173",
    credentials: true,
  }),
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
app.route("/api/sync", syncRoutes);
app.route("/api/emails", emailsRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/people", peopleRoutes);
app.route("/api/companies", companiesRoutes);
app.route("/api/tasks", tasksRoutes);
app.route("/api/notes", notesRoutes);

async function handleScheduledSync(env: Env) {
  const db = createDb(env.DB);
  await runScheduledIncrementalSync(db, env);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledSync(env));
  },
};
