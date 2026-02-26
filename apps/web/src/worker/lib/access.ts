import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { orgMembers } from "../db/schema";

export async function ensureOrgAccess(
  db: Database,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });

  return Boolean(membership);
}
