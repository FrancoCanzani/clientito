import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { briefingDecisions, proposedEvents } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const bodySchema = z.object({
  itemType: z.enum(["email", "task", "proposed_event"]),
  referenceId: z.number().int().positive(),
  decision: z.enum(["dismissed", "replied", "archived", "approved"]),
});

export function registerPostBriefingDecision(app: Hono<AppRouteEnv>) {
  app.post(
    "/briefing/decision",
    zValidator("json", bodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { itemType, referenceId, decision } = c.req.valid("json");
      const now = Date.now();

      await db
        .insert(briefingDecisions)
        .values({
          userId: user.id,
          itemType,
          referenceId,
          decision,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            briefingDecisions.userId,
            briefingDecisions.itemType,
            briefingDecisions.referenceId,
          ],
          set: { decision, updatedAt: now },
        });

      if (itemType === "proposed_event") {
        const peStatus =
          decision === "approved" ? "approved" : "dismissed";
        await db
          .update(proposedEvents)
          .set({ status: peStatus, updatedAt: now })
          .where(
            and(
              eq(proposedEvents.id, referenceId),
              eq(proposedEvents.userId, user.id),
            ),
          );
      }

      return c.json({ data: { ok: true } }, 200);
    },
  );
}
