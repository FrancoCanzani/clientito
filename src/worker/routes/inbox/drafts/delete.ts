import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drafts } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";
import { draftIdParamsSchema, deleteDraftByKeyQuerySchema } from "./schemas";

export function registerDeleteDrafts(api: Hono<AppRouteEnv>) {
  api.delete("/:id", zValidator("param", draftIdParamsSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { id } = c.req.valid("param");

    await db
      .delete(drafts)
      .where(and(eq(drafts.id, id), eq(drafts.userId, user.id)));

    return c.json({ data: { deleted: true } }, 200);
  });

  api.delete(
    "/by-key",
    zValidator("query", deleteDraftByKeyQuerySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { composeKey } = c.req.valid("query");

      await db
        .delete(drafts)
        .where(
          and(eq(drafts.userId, user.id), eq(drafts.composeKey, composeKey)),
        );

      return c.json({ data: { deleted: true } }, 200);
    },
  );
}
