import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import {
  findCalendarSuggestionById,
  updateCalendarSuggestion,
} from "../../lib/email/intelligence/store";
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
  attendees: z.array(z.email()).optional(),
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

      const match = await findCalendarSuggestionById(db, user.id, id);
      if (!match || match.suggestion.status !== "pending") {
        return c.json({ error: "Proposed event not found" }, 404);
      }

      await updateCalendarSuggestion(db, match, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
        ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
        ...(input.attendees !== undefined
          ? { attendees: input.attendees }
          : {}),
        ...(input.description !== undefined
          ? { sourceText: input.description }
          : {}),
      });

      return c.json({ data: { updated: true } }, 200);
    },
  );
}
