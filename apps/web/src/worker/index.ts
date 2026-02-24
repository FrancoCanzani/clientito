import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "../../auth";
import { authMiddleware } from "./auth/middleware";
import githubRoutes from "./routes/github/router";
import healthRoutes from "./routes/health/router";
import orgRoutes from "./routes/org/router";
import projectRoutes from "./routes/project/router";
import releaseRoutes from "./routes/release/router";

const app = new Hono();

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
  const auth = createAuth(c.env as Env);
  return auth.handler(c.req.raw);
});

app.route("/api/health", healthRoutes);
app.route("/api/orgs", orgRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/releases", releaseRoutes);
app.route("/api/github", githubRoutes);

export default app;
