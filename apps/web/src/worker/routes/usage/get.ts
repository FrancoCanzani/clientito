import type { Context } from "hono";
import { and, count, eq, gte } from "drizzle-orm";
import { impressions, mauDaily, projects } from "../../db/schema";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import type { AppRouteEnv } from "../types";

async function verifyProjectAccess(c: Context<AppRouteEnv>, projectId: string) {
  const user = c.get("user");
  const db = c.get("db");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw notFound("Project not found");
  if (!user.orgs.some((org) => org.orgId === project.orgId)) throw forbidden();
}

export async function getUsageSummary(c: Context<AppRouteEnv>) {
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId) throw badRequest("projectId query param required");

  await verifyProjectAccess(c, projectId);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);

  const startOfTodayEpoch = Math.floor(new Date(`${today}T00:00:00.000Z`).getTime() / 1000);
  const startOfMonthEpoch = Math.floor(new Date(`${month}-01T00:00:00.000Z`).getTime() / 1000);

  const [{ value: lifetimeImpressions }] = await db
    .select({ value: count() })
    .from(impressions)
    .where(eq(impressions.projectId, projectId));

  const [{ value: todayImpressions }] = await db
    .select({ value: count() })
    .from(impressions)
    .where(and(eq(impressions.projectId, projectId), gte(impressions.createdAt, startOfTodayEpoch)));

  const [{ value: monthImpressions }] = await db
    .select({ value: count() })
    .from(impressions)
    .where(and(eq(impressions.projectId, projectId), gte(impressions.createdAt, startOfMonthEpoch)));

  const [{ value: todayMau }] = await db
    .select({ value: count() })
    .from(mauDaily)
    .where(and(eq(mauDaily.projectId, projectId), eq(mauDaily.day, today)));

  const monthMauRows = await db
    .select({ endUserId: mauDaily.endUserId })
    .from(mauDaily)
    .where(and(eq(mauDaily.projectId, projectId), gte(mauDaily.day, `${month}-01`)));

  const monthMau = new Set(monthMauRows.map((row) => row.endUserId)).size;

  return c.json({
    data: {
      today,
      month,
      todayStats: {
        impressions: todayImpressions,
        mau: todayMau,
      },
      currentMonth: {
        impressions: monthImpressions,
        mau: monthMau,
      },
      lifetime: {
        impressions: lifetimeImpressions,
      },
    },
  });
}
