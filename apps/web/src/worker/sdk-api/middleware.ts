import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { createDb, type Database } from "../db/client";
import { projects, organizations } from "../db/schema";
import { unauthorized } from "../lib/errors";

export type SdkContext = {
  projectId: string;
  orgId: string;
  plan: string;
  brandingEnabled: boolean;
  db: Database;
};

type SdkEnv = {
  Bindings: Env;
  Variables: {
    sdk: SdkContext;
  };
};

export const sdkMiddleware = createMiddleware<SdkEnv>(async (c, next) => {
  // CORS for SDK requests
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, If-None-Match");

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  const key = c.req.query("key") ?? c.req.header("X-SDK-Key");
  if (!key) throw unauthorized("Missing SDK key");

  const db = createDb(c.env.DB);

  const project = await db.query.projects.findFirst({
    where: eq(projects.sdkKey, key),
  });
  if (!project) throw unauthorized("Invalid SDK key");

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, project.orgId),
  });

  c.set("sdk", {
    projectId: project.id,
    orgId: project.orgId,
    plan: org?.plan ?? "free",
    brandingEnabled: project.brandingEnabled,
    db,
  });

  await next();
});
