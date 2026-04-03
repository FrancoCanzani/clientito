import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { briefingDecisions, emailIntelligence } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const bodySchema = z.object({
  itemType: z.enum(["email_action", "task", "calendar_suggestion"]),
  referenceId: z.number().int().positive(),
  decision: z.enum(["dismissed", "replied", "archived", "approved"]),
  actionId: z.string().trim().optional(),
});

export function registerPostBriefingDecision(app: Hono<AppRouteEnv>) {
  app.post(
    "/briefing/decision",
    zValidator("json", bodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { itemType, referenceId, decision, actionId } = c.req.valid("json");
      const now = Date.now();

      if (itemType === "task") {
        await db
          .insert(briefingDecisions)
          .values({
            userId: user.id,
            itemType: "task",
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
        return c.json({ data: { ok: true } }, 200);
      }

      if (itemType === "email_action") {
        if (!actionId) return c.json({ error: "Action id required" }, 400);

        const rows = await db
          .select()
          .from(emailIntelligence)
          .where(
            and(
              eq(emailIntelligence.emailId, referenceId),
              eq(emailIntelligence.userId, user.id),
            ),
          )
          .limit(1);

        const row = rows[0];
        if (!row) return c.json({ error: "Email intelligence not found" }, 404);

        const actions = (row.actionsJson ?? []).map((action) =>
          action.id === actionId
            ? {
                ...action,
                status: decision === "dismissed" ? "dismissed" : "executed",
                executedAt: decision !== "dismissed" ? now : action.executedAt,
                updatedAt: now,
              }
            : action,
        );

        await db
          .update(emailIntelligence)
          .set({ actionsJson: actions, updatedAt: now })
          .where(eq(emailIntelligence.id, row.id));

        return c.json({ data: { ok: true } }, 200);
      }

      if (itemType === "calendar_suggestion") {
        const rows = await db
          .select()
          .from(emailIntelligence)
          .where(eq(emailIntelligence.userId, user.id));

        for (const row of rows) {
          const nextEvents = (row.calendarEventsJson ?? []).map((event) =>
            event.id === referenceId
              ? {
                  ...event,
                  status:
                    decision === "approved"
                      ? ("approved" as const)
                      : ("dismissed" as const),
                  updatedAt: now,
                }
              : event,
          );

          if (nextEvents.some((event) => event.id === referenceId)) {
            await db
              .update(emailIntelligence)
              .set({ calendarEventsJson: nextEvents, updatedAt: now })
              .where(eq(emailIntelligence.id, row.id));
            return c.json({ data: { ok: true } }, 200);
          }
        }

        return c.json({ error: "Calendar suggestion not found" }, 404);
      }

      return c.json({ data: { ok: true } }, 200);
    },
  );
}
