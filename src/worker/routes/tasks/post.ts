import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { emails, tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { postTaskBodySchema } from "./schemas";
import { TASK_COLUMNS } from "./utils";

export function registerPostTasks(api: Hono<AppRouteEnv>) {
  return api.post("/", zValidator("json", postTaskBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { title, description, sourceEmailId, dueAt, priority, status } =
      c.req.valid("json");

    if (sourceEmailId !== undefined) {
      const sourceEmail = await db
        .select({ id: emails.id })
        .from(emails)
        .where(and(eq(emails.id, sourceEmailId), eq(emails.userId, user.id)))
        .limit(1);

      if (!sourceEmail[0]) {
        return c.json({ error: "Source email not found" }, 400);
      }
    }

    const inserted = await db
      .insert(tasks)
      .values({
        userId: user.id,
        title,
        description: description ?? null,
        sourceEmailId: sourceEmailId ?? null,
        dueAt: dueAt ?? null,
        priority: priority ?? "low",
        status: status ?? "todo",
        createdAt: Date.now(),
      })
      .returning({ id: tasks.id });

    const createdId = inserted[0]!.id;

    const rows = await db
      .select(TASK_COLUMNS)
      .from(tasks)
      .where(and(eq(tasks.id, createdId), eq(tasks.userId, user.id)))
      .limit(1);

    return c.json({ data: rows[0]! }, 201);
  });
}
