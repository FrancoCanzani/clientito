import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { auth } from "../../auth";
import { authMiddleware } from "./middleware/auth";
import aiRoutes from "./routes/ai/router";
import healthRoutes from "./routes/health/router";
import inboxRoutes from "./routes/inbox/router";
import settingsRoutes from "./routes/settings/router";
import splitViewsRoutes from "./routes/split-views/router";
import draftsRoutes from "./routes/inbox/drafts/router";
import type { AppRouteEnv } from "./routes/types";
import { handleScheduled } from "./scheduled";
import {
  handleEmailLabelMutations,
  type EmailLabelMutationMessage,
} from "./queues/email-label-mutations";

const app = new Hono<AppRouteEnv>();

app.use("*", logger());
app.use("*", secureHeaders({
  crossOriginEmbedderPolicy: "credentialless",
}));

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

app.get("/api/version", (c) => c.json({ version: c.env.APP_VERSION }));

app.use("*", authMiddleware);

app.all("/api/auth/*", async (c) => {
  const authInstance = auth(c.env);
  return authInstance.handler(c.req.raw);
});

app.route("/api/health", healthRoutes);
app.route("/api/inbox", inboxRoutes);
app.route("/api/ai", aiRoutes);

app.route("/api/inbox/drafts", draftsRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/split-views", splitViewsRoutes);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(event, env));
  },
  async queue(batch: MessageBatch<EmailLabelMutationMessage>, env: Env) {
    await handleEmailLabelMutations(batch, env);
  },
};
