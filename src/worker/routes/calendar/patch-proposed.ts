import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { proposedEvents } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
  startAt: z.number().int().positive().optional(),
  endAt: z.number().int().positive().optional(),
  attendees: z.array(z.string().email()).optional(),
});

export function registerPatchProposed(api: Hono<AppRouteEnv>) {
  api.patch(
    "/proposed/:id",
    zValidator("param", paramsSchema),
    zValidator("json", bodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      const rows = await db
        .select({ id: proposedEvents.id })
        .from(proposedEvents)
        .where(
          and(
            eq(proposedEvents.id, id),
            eq(proposedEvents.userId, user.id),
            eq(proposedEvents.status, "pending"),
          ),
        )
        .limit(1);

      if (!rows[0]) return c.json({ error: "Proposed event not found" }, 404);

      await db
        .update(proposedEvents)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
          ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
          ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
          ...(input.attendees !== undefined
            ? { attendees: input.attendees }
            : {}),
          updatedAt: Date.now(),
        })
        .where(eq(proposedEvents.id, id));

      return c.json({ data: { updated: true } }, 200);
    },
  );
}
