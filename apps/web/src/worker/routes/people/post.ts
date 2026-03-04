import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { companies, people } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { createPersonBodySchema } from "./schemas";

export function registerPostPeople(api: Hono<AppRouteEnv>) {
  return api.post("/", zValidator("json", createPersonBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { email, name, phone, title, linkedin, companyId } = c.req.valid("json");
    const now = Date.now();

    if (companyId !== undefined) {
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.userId, user.id)))
        .limit(1);
      if (!company[0]) return c.json({ error: "Company not found" }, 404);
    }

    const inserted = await db
      .insert(people)
      .values({
        userId: user.id,
        email,
        name: name ?? null,
        phone: phone ?? null,
        title: title ?? null,
        linkedin: linkedin ?? null,
        companyId: companyId ?? null,
        createdAt: now,
      })
      .returning({ id: people.id });

    const createdId = inserted[0]!.id;

    const rows = await db
      .select({
        id: people.id,
        email: people.email,
        name: people.name,
        phone: people.phone,
        title: people.title,
        linkedin: people.linkedin,
        companyId: people.companyId,
        companyName: companies.name,
        companyDomain: companies.domain,
        lastContactedAt: people.lastContactedAt,
        createdAt: people.createdAt,
      })
      .from(people)
      .leftJoin(
        companies,
        and(eq(companies.id, people.companyId), eq(companies.userId, user.id)),
      )
      .where(and(eq(people.id, createdId), eq(people.userId, user.id)))
      .limit(1);

    return c.json({ data: rows[0]! }, 201);
  });
}
