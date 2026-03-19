import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { tasks } from "../../db/schema";
import { getDayBoundsUtc } from "../../lib/utils";
import type { AppRouteEnv } from "../types";
import { TASK_COLUMNS } from "./helpers";
import { getTasksQuerySchema } from "./schemas";

export function registerGetTasks(api: Hono<AppRouteEnv>) {
  api.get("/", zValidator("query", getTasksQuerySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const {
      dueToday,
      dueAfter,
      dueBefore,
      status,
      view,
      limit,
      offset = 0,
    } = c.req.valid("query");
    const conditions = [eq(tasks.userId, user.id)];

    if (view === "today") {
      const { start, end } = getDayBoundsUtc(Date.now());
      conditions.push(gte(tasks.dueAt, start), lt(tasks.dueAt, end));
    } else if (view === "upcoming") {
      conditions.push(gte(tasks.dueAt, Date.now()));
    }

    if (status !== undefined) {
      conditions.push(eq(tasks.status, status));
    }

    if (dueToday) {
      const { start, end } = getDayBoundsUtc(Date.now());
      conditions.push(gte(tasks.dueAt, start), lt(tasks.dueAt, end));
    }

    if (dueAfter !== undefined) {
      conditions.push(gte(tasks.dueAt, dueAfter));
    }

    if (dueBefore !== undefined) {
      conditions.push(lte(tasks.dueAt, dueBefore));
    }

    const whereClause = and(...conditions);

    const baseRowsQuery = db
      .select(TASK_COLUMNS)
      .from(tasks)
      .where(whereClause)
      .orderBy(asc(tasks.position), asc(tasks.dueAt), desc(tasks.createdAt));

    const rowsQuery =
      limit !== undefined
        ? baseRowsQuery.limit(limit).offset(offset)
        : baseRowsQuery;

    const [rows, totalRows] = await Promise.all([
      rowsQuery,
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(whereClause),
    ]);

    return c.json(
      {
        data: rows,
        pagination: {
          total: Number(totalRows[0]?.count ?? 0),
          limit: limit ?? null,
          offset,
        },
      },
      200,
    );
  });

}
