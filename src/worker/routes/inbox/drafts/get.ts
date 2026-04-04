import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { drafts } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";
import { deleteDraftByKeyQuerySchema, getDraftsQuerySchema } from "./schemas";
import { DRAFT_COLUMNS } from "./utils";

export function registerGetDrafts(api: Hono<AppRouteEnv>) {
  api.get("/", zValidator("query", getDraftsQuerySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { mailboxId } = c.req.valid("query");

    const rows = await db
      .select(DRAFT_COLUMNS)
      .from(drafts)
      .where(
        mailboxId == null
          ? eq(drafts.userId, user.id)
          : and(eq(drafts.userId, user.id), eq(drafts.mailboxId, mailboxId)),
      )
      .orderBy(desc(drafts.updatedAt));

    return c.json({ data: rows }, 200);
  });

  api.get(
    "/by-key",
    zValidator("query", deleteDraftByKeyQuerySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { composeKey } = c.req.valid("query");

      const rows = await db
        .select(DRAFT_COLUMNS)
        .from(drafts)
        .where(and(eq(drafts.userId, user.id), eq(drafts.composeKey, composeKey)))
        .limit(1);

      if (!rows[0]) {
        return c.json({ data: null }, 200);
      }

      return c.json({ data: rows[0] }, 200);
    },
  );
}
