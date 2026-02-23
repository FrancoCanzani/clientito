import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { releases, sdkConfigs, checklists, checklistItems } from "../db/schema";
import { sdkMiddleware, type SdkContext } from "./middleware";
import type { Database } from "../db/client";
import type { SdkInitResponse, SdkRelease, SdkChecklist } from "@releaselayer/shared";

type Env_ = {
  Bindings: Env;
  Variables: { sdk: SdkContext };
};

const initRoute = new Hono<Env_>();

initRoute.use("/*", sdkMiddleware);

initRoute.get("/", async (c) => {
  const { projectId, brandingEnabled, db } = c.get("sdk");

  // Fetch published releases
  const now = Math.floor(Date.now() / 1000);
  const publishedReleases = await db
    .select()
    .from(releases)
    .where(
      and(
        eq(releases.projectId, projectId),
        eq(releases.status, "published")
      )
    );

  // Filter by scheduling (publishAt/unpublishAt)
  const activeReleases = publishedReleases.filter((r) => {
    if (r.publishAt && r.publishAt > now) return false;
    if (r.unpublishAt && r.unpublishAt < now) return false;
    return true;
  });

  // Map to SDK format
  const sdkReleases: SdkRelease[] = activeReleases.map((r) => ({
    id: r.id,
    title: r.title,
    contentHtml: r.aiRewriteHtml ?? r.contentHtml ?? r.contentMd,
    displayType: r.displayType as "modal" | "banner" | "changelog",
    showOnce: r.showOnce ?? true,
    targetTraits: r.targetTraits ? JSON.parse(r.targetTraits) : null,
    publishedAt: r.publishedAt ?? r.createdAt,
  }));

  // Fetch SDK config
  const config = await db.query.sdkConfigs.findFirst({
    where: eq(sdkConfigs.projectId, projectId),
  });

  // Fetch active checklist
  const checklist = await getActiveChecklist(db, projectId);

  const response: SdkInitResponse = {
    releases: sdkReleases,
    config: {
      theme: config?.theme ? JSON.parse(config.theme) : {},
      position: config?.position ?? "bottom-right",
      zIndex: config?.zIndex ?? 99999,
      customCss: config?.customCss ?? null,
      brandingEnabled,
    },
    checklist,
  };

  // ETag for caching
  const body = JSON.stringify(response);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(body));
  const etag = `"${Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16)}"`;

  const ifNoneMatch = c.req.header("If-None-Match");
  if (ifNoneMatch === etag) {
    return c.body(null, 304);
  }

  c.header("ETag", etag);
  c.header("Cache-Control", "public, max-age=60");
  return c.json(response);
});

async function getActiveChecklist(db: Database, projectId: string): Promise<SdkChecklist | null> {
  const cl = await db.query.checklists.findFirst({
    where: and(
      eq(checklists.projectId, projectId),
      eq(checklists.isActive, true)
    ),
  });
  if (!cl) return null;

  const items = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, cl.id))
    .orderBy(checklistItems.sortOrder);

  return {
    id: cl.id,
    title: cl.title,
    description: cl.description,
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      trackEvent: i.trackEvent,
      sortOrder: i.sortOrder,
    })),
  };
}

export default initRoute;
