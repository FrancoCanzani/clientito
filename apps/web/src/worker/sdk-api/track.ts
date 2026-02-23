import { Hono } from "hono";
import { sdkMiddleware, type SdkContext } from "./middleware";
import { impressions, mauDaily } from "../db/schema";
import { generateId } from "../lib/slug";
import { sdkTrackEventsSchema } from "@releaselayer/shared";
import { badRequest } from "../lib/errors";
import { parseJsonBody } from "../lib/request";

type Env_ = {
  Bindings: Env;
  Variables: { sdk: SdkContext };
};

const trackRoute = new Hono<Env_>();

trackRoute.use("/*", sdkMiddleware);

trackRoute.post("/", async (c) => {
  const { projectId, db } = c.get("sdk");
  const body = await parseJsonBody<unknown>(c);
  const parsed = sdkTrackEventsSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0].message);

  const events = Array.isArray(parsed.data) ? parsed.data : [parsed.data];

  const now = Math.floor(Date.now() / 1000);
  const today = new Date().toISOString().slice(0, 10);

  const impressionInserts = events.map((event) => ({
    id: generateId(),
    projectId,
    releaseId: event.releaseId ?? null,
    endUserId: event.endUserId,
    eventType: event.type,
    eventData: event.data ? JSON.stringify(event.data) : null,
    createdAt: now,
  }));

  // Deduplicated MAU entries
  const uniqueUsers = [...new Set(events.map((e) => e.endUserId))];
  const mauInserts = uniqueUsers.map((uid) => ({
    projectId,
    day: today,
    endUserId: uid,
  }));

  // Batch write impressions
  await db.insert(impressions).values(impressionInserts);

  // Upsert MAU (ignore conflicts on the composite PK)
  for (const mau of mauInserts) {
    await db.insert(mauDaily).values(mau).onConflictDoNothing();
  }

  return c.json({ ok: true, tracked: events.length });
});

export default trackRoute;
