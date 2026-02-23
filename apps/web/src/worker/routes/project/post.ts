import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { createProjectSchema } from "@releaselayer/shared";
import { badRequest } from "../../lib/errors";
import { generateId, generateSdkKey } from "../../lib/slug";
import { parseJsonBody } from "../../lib/request";
import { projects, sdkConfigs } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  assertProjectLimit,
  assertProjectSlugAvailable,
  requireOrgMembership,
} from "./helpers";

export async function createProject(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const body = await parseJsonBody<unknown>(c);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid project payload");

  const orgId = c.req.query("orgId");
  if (!orgId) throw badRequest("orgId query param required");

  requireOrgMembership(user, orgId);
  await assertProjectLimit(db, orgId);
  await assertProjectSlugAvailable(db, orgId, parsed.data.slug);

  const id = generateId();
  const sdkKey = generateSdkKey();

  await db.batch([
    db.insert(projects).values({ id, orgId, sdkKey, ...parsed.data }),
    db.insert(sdkConfigs).values({ projectId: id }),
  ]);

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  return c.json({ data: project }, 201);
}
