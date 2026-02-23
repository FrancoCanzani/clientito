import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { createReleaseSchema } from "@releaselayer/shared";
import { badRequest } from "../../lib/errors";
import { parseJsonBody } from "../../lib/request";
import { generateId } from "../../lib/slug";
import { releases } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { assertReleaseSlugAvailable, verifyProjectAccess, verifyReleaseAccess } from "./helpers";

export async function createRelease(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId) throw badRequest("projectId query param required");

  await verifyProjectAccess(db, user, projectId);

  const body = await parseJsonBody<unknown>(c);
  const parsed = createReleaseSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid release payload");

  await assertReleaseSlugAvailable(db, projectId, parsed.data.slug);

  const id = generateId();
  const { targetTraits, metadata, ...rest } = parsed.data;

  await db.insert(releases).values({
    id,
    projectId,
    ...rest,
    targetTraits: targetTraits ? JSON.stringify(targetTraits) : null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });

  const release = await db.query.releases.findFirst({
    where: eq(releases.id, id),
  });

  return c.json({ data: release }, 201);
}

export async function publishRelease(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const releaseId = c.req.param("rid");

  await verifyReleaseAccess(db, user, releaseId);

  const now = Math.floor(Date.now() / 1000);
  await db
    .update(releases)
    .set({
      status: "published",
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(releases.id, releaseId));

  return c.json({ ok: true });
}
