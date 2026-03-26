import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { proposedEvents } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const bodySchema = z.object({
  mailboxId: z.number().int().positive().optional(),
  emailId: z.number().int().positive().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
  startAt: z.number().int().positive(),
  endAt: z.number().int().positive(),
  attendees: z.array(z.string().email()).optional(),
});

export function registerPostProposedEvent(api: Hono<AppRouteEnv>) {
  api.post("/proposed", zValidator("json", bodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const input = c.req.valid("json");
    const now = Date.now();

    const rows = await db
      .insert(proposedEvents)
      .values({
        userId: user.id,
        mailboxId: input.mailboxId ?? null,
        emailId: input.emailId ?? null,
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        startAt: input.startAt,
        endAt: input.endAt,
        attendees: input.attendees ?? null,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: proposedEvents.id });

    return c.json({ data: { id: rows[0].id } }, 201);
  });
}
