import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { updateReleaseSchema } from "@releaselayer/shared";
import { badRequest } from "../../lib/errors";
import { parseJsonBody } from "../../lib/request";
import { releases } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { verifyReleaseAccess } from "./helpers";

export async function updateReleaseById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const releaseId = c.req.param("rid");

  await verifyReleaseAccess(db, user, releaseId);

  const body = await parseJsonBody<unknown>(c);
  const parsed = updateReleaseSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid release payload");

  const { targetTraits, metadata, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = {
    ...rest,
    updatedAt: Math.floor(Date.now() / 1000),
  };

  if (targetTraits !== undefined) {
    updateData.targetTraits = JSON.stringify(targetTraits);
  }

  if (metadata !== undefined) {
    updateData.metadata = JSON.stringify(metadata);
  }

  await db.update(releases).set(updateData).where(eq(releases.id, releaseId));

  const updated = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
  });

  return c.json({ data: updated });
}
