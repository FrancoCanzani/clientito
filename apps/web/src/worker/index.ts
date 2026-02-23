import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "../../auth";
import { authMiddleware, requireAuth } from "./auth/middleware";
import sdkInitRoute from "./sdk-api/init";
import sdkTrackRoute from "./sdk-api/track";
import healthRoutes from "./routes/health/router";
import userRoutes from "./routes/user/router";
import projectRoutes from "./routes/project/router";
import releaseRoutes from "./routes/release/router";
import checklistRoutes from "./routes/checklist/router";
import integrationRoutes from "./routes/integration/router";
import sdkConfigRoutes from "./routes/sdk-config/router";
import usageRoutes from "./routes/usage/router";

const app = new Hono<{ Bindings: Env }>();

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

app.use("/api/users/*", requireAuth);
app.use("/api/projects/*", requireAuth);
app.use("/api/releases/*", requireAuth);
app.use("/api/sdk-config/*", requireAuth);
app.use("/api/checklists/*", requireAuth);
app.use("/api/integrations/*", requireAuth);
app.use("/api/usage/*", requireAuth);
app.route("/api/users", userRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/releases", releaseRoutes);
app.route("/api/sdk-config", sdkConfigRoutes);
app.route("/api/checklists", checklistRoutes);
app.route("/api/integrations", integrationRoutes);
app.route("/api/usage", usageRoutes);

app.route("/sdk/init", sdkInitRoute);
app.route("/sdk/track", sdkTrackRoute);

export default app;
