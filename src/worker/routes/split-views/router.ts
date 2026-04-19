import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { splitViews, type SplitRule } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const SYSTEM_SPLITS: Array<{
  systemKey: string;
  name: string;
  description: string;
  rules: SplitRule;
  visibleByDefault: boolean;
}> = [
  {
    systemKey: "important",
    name: "Important",
    description: "Emails Gmail marks as important.",
    rules: { gmailLabels: ["IMPORTANT"] },
    visibleByDefault: false,
  },
  {
    systemKey: "calendar",
    name: "Calendar",
    description: "Emails with a calendar invite (.ics) attached.",
    rules: { hasCalendar: true },
    visibleByDefault: true,
  },
];

const splitRuleSchema: z.ZodType<SplitRule> = z.object({
  domains: z.array(z.string()).optional(),
  senders: z.array(z.string()).optional(),
  recipients: z.array(z.string()).optional(),
  subjectContains: z.array(z.string()).optional(),
  hasAttachment: z.boolean().nullable().optional(),
  fromMailingList: z.boolean().nullable().optional(),
  hasCalendar: z.boolean().nullable().optional(),
  gmailLabels: z.array(z.string()).optional(),
});

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(64),
  description: z.string().max(240).optional().default(""),
  icon: z.string().max(64).nullable().optional(),
  color: z.string().max(24).nullable().optional(),
  rules: splitRuleSchema.nullable().optional(),
  showInOther: z.boolean().optional(),
  pinned: z.boolean().optional(),
  visible: z.boolean().optional(),
});

const updateBodySchema = createBodySchema.partial().extend({
  position: z.number().int().min(0).optional(),
});

const reorderBodySchema = z.object({
  ids: z.array(z.string().min(1)).max(64),
});

function cryptoId(): string {
  return crypto.randomUUID();
}

async function ensureSystemSplits(
  db: AppRouteEnv["Variables"]["db"],
  userId: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(splitViews)
    .where(eq(splitViews.userId, userId));
  const byKey = new Map(
    existing
      .filter((v) => v.systemKey != null)
      .map((v) => [v.systemKey as string, v]),
  );
  const now = Date.now();
  const maxPos = existing.reduce((m, v) => Math.max(m, v.position), -1);
  let nextPos = maxPos + 1;

  for (const sys of SYSTEM_SPLITS) {
    if (byKey.has(sys.systemKey)) continue;
    await db.insert(splitViews).values({
      id: cryptoId(),
      userId,
      name: sys.name,
      description: sys.description,
      icon: null,
      color: null,
      position: nextPos++,
      visible: sys.visibleByDefault,
      pinned: false,
      isSystem: true,
      systemKey: sys.systemKey,
      rules: sys.rules,
      matchMode: "rules",
      showInOther: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

const splitViewsRoutes = new Hono<AppRouteEnv>();

splitViewsRoutes.use("*", requireAuth);

splitViewsRoutes.get("/", async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  await ensureSystemSplits(db, user.id);
  const rows = await db
    .select()
    .from(splitViews)
    .where(eq(splitViews.userId, user.id));
  rows.sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
  return c.json({ data: { splitViews: rows } });
});

splitViewsRoutes.post("/", zValidator("json", createBodySchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const body = c.req.valid("json");
  const now = Date.now();

  const existing = await db
    .select({ position: splitViews.position })
    .from(splitViews)
    .where(eq(splitViews.userId, user.id));
  const nextPos = existing.reduce((m, v) => Math.max(m, v.position), -1) + 1;

  const id = cryptoId();
  await db.insert(splitViews).values({
    id,
    userId: user.id,
    name: body.name,
    description: body.description ?? "",
    icon: body.icon ?? null,
    color: body.color ?? null,
    position: nextPos,
    visible: body.visible ?? true,
    pinned: body.pinned ?? false,
    isSystem: false,
    systemKey: null,
    rules: body.rules ?? null,
    matchMode: "rules",
    showInOther: body.showInOther ?? true,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(splitViews)
    .where(and(eq(splitViews.id, id), eq(splitViews.userId, user.id)));
  return c.json({ data: { splitView: created } }, 201);
});

splitViewsRoutes.patch(
  "/:id",
  zValidator("json", updateBodySchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const [existing] = await db
      .select()
      .from(splitViews)
      .where(and(eq(splitViews.id, id), eq(splitViews.userId, user.id)));
    if (!existing) return c.json({ error: "Not found" }, 404);

    const patch: Partial<typeof splitViews.$inferInsert> = {
      updatedAt: Date.now(),
    };
    if (existing.isSystem) {
      if (body.visible !== undefined) patch.visible = body.visible;
      if (body.pinned !== undefined) patch.pinned = body.pinned;
      if (body.position !== undefined) patch.position = body.position;
    } else {
      if (body.name !== undefined) patch.name = body.name;
      if (body.description !== undefined) patch.description = body.description;
      if (body.icon !== undefined) patch.icon = body.icon;
      if (body.color !== undefined) patch.color = body.color;
      if (body.rules !== undefined) patch.rules = body.rules;
      if (body.showInOther !== undefined) patch.showInOther = body.showInOther;
      if (body.visible !== undefined) patch.visible = body.visible;
      if (body.pinned !== undefined) patch.pinned = body.pinned;
      if (body.position !== undefined) patch.position = body.position;
    }

    await db
      .update(splitViews)
      .set(patch)
      .where(and(eq(splitViews.id, id), eq(splitViews.userId, user.id)));

    const [updated] = await db
      .select()
      .from(splitViews)
      .where(and(eq(splitViews.id, id), eq(splitViews.userId, user.id)));
    return c.json({ data: { splitView: updated } });
  },
);

splitViewsRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(splitViews)
    .where(and(eq(splitViews.id, id), eq(splitViews.userId, user.id)));
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.isSystem) {
    return c.json({ error: "Cannot delete system split" }, 400);
  }

  await db
    .delete(splitViews)
    .where(and(eq(splitViews.id, id), eq(splitViews.userId, user.id)));

  return c.json({ data: { id } });
});

splitViewsRoutes.post(
  "/system/:key/visible",
  zValidator("json", z.object({ visible: z.boolean() })),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const key = c.req.param("key");
    const { visible } = c.req.valid("json");

    await ensureSystemSplits(db, user.id);

    const [existing] = await db
      .select()
      .from(splitViews)
      .where(
        and(eq(splitViews.userId, user.id), eq(splitViews.systemKey, key)),
      );
    if (!existing) return c.json({ error: "Unknown system split" }, 404);

    await db
      .update(splitViews)
      .set({ visible, updatedAt: Date.now() })
      .where(eq(splitViews.id, existing.id));

    const [updated] = await db
      .select()
      .from(splitViews)
      .where(eq(splitViews.id, existing.id));
    return c.json({ data: { splitView: updated } });
  },
);

splitViewsRoutes.put(
  "/reorder",
  zValidator("json", reorderBodySchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { ids } = c.req.valid("json");
    const now = Date.now();

    for (let i = 0; i < ids.length; i++) {
      await db
        .update(splitViews)
        .set({ position: i, updatedAt: now })
        .where(and(eq(splitViews.id, ids[i]!), eq(splitViews.userId, user.id)));
    }

    const rows = await db
      .select()
      .from(splitViews)
      .where(eq(splitViews.userId, user.id));
    rows.sort((a, b) => a.position - b.position);
    return c.json({ data: { splitViews: rows } });
  },
);

export default splitViewsRoutes;
