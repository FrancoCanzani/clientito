import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { auth } from "../../auth";
import { authMiddleware } from "./middleware/auth";
import {
  authLimiter,
  standardLimiter,
  strictLimiter,
} from "./middleware/rate-limit";
import aiRoutes from "./routes/ai/router";
import calendarRoutes from "./routes/calendar/router";
import healthRoutes from "./routes/health/router";
import emailsRoutes from "./routes/inbox/emails/router";
import filtersRoutes from "./routes/inbox/filters/router";
import inboxRoutes from "./routes/inbox/router";
import searchRoutes from "./routes/inbox/search/router";
import subscriptionsRoutes from "./routes/inbox/subscriptions/router";
import syncRoutes from "./routes/inbox/sync/router";
import settingsRoutes from "./routes/settings/router";
import tasksRoutes from "./routes/tasks/router";
import type { AppRouteEnv } from "./routes/types";
import { handleScheduled } from "./scheduled";

export { Agent } from "./agent/agent";

const app = new Hono<AppRouteEnv>();

app.use("*", logger());
app.use("*", secureHeaders());

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin || "http://localhost:5173",
    credentials: true,
  }),
);

app.use("/api/*", csrf());

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

app.use("*", authMiddleware);

app.use("/api/auth/*", authLimiter);
app.use("/api/sync/start", strictLimiter);
app.use("/api/sync/recover", strictLimiter);
app.use("/api/emails/send", strictLimiter);
app.use("/api/inbox/sync/start", strictLimiter);
app.use("/api/inbox/sync/recover", strictLimiter);
app.use("/api/inbox/emails/send", strictLimiter);
app.use("/api/ai/*", strictLimiter);
app.use("/api/*", standardLimiter);

app.all("/api/auth/*", async (c) => {
  const authInstance = auth(c.env);
  return authInstance.handler(c.req.raw);
});

app.route("/api/health", healthRoutes);
app.route("/api/inbox", inboxRoutes);
app.route("/api/sync", syncRoutes);
app.route("/api/emails", emailsRoutes);
app.route("/api/ai", aiRoutes);

app.route("/api/tasks", tasksRoutes);
app.route("/api/calendar", calendarRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/search", searchRoutes);
app.route("/api/subscriptions", subscriptionsRoutes);
app.route("/api/filters", filtersRoutes);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;
    return app.fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(event, env));
  },
};
