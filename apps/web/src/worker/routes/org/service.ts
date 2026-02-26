import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { orgMembers, organizations } from "../../db/schema";
import { unixNow } from "../../lib/slug";
import {
  resolveOrganizationNameAndSlug,
  toOrganizationListResponse,
  toOrganizationResponse,
  type OrganizationRecord,
} from "./helpers";

export async function listOrganizationsForUser(db: Database, userId: string) {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: orgMembers.role,
      createdAt: organizations.createdAt,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, userId))
    .orderBy(asc(organizations.name));

  return rows.map(toOrganizationListResponse);
}

export async function createOrganizationForUser(
  db: Database,
  userId: string,
  nameInput: string,
) {
  const { name, slug } = await resolveOrganizationNameAndSlug(db, nameInput);

  const now = unixNow();
  const inserted = await db
    .insert(organizations)
    .values({
      name,
      slug,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: organizations.id });
  const orgId = inserted[0]!.id;

  await db.insert(orgMembers).values({
    orgId,
    userId,
    role: "owner",
    createdAt: now,
  });

  const created = (await db.query.organizations.findFirst({
    where: and(eq(organizations.id, orgId), eq(organizations.createdByUserId, userId)),
  })) as OrganizationRecord | undefined;

  return created ? toOrganizationResponse(created) : null;
}

type UpdateOrganizationResult =
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "ok"; data: ReturnType<typeof toOrganizationResponse> };

export async function updateOrganizationForOwner(
  db: Database,
  userId: string,
  orgId: string,
  nameInput: string,
): Promise<UpdateOrganizationResult> {
  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });

  if (!membership || membership.role !== "owner") {
    return { status: "forbidden" };
  }

  const updatedRows = await db
    .update(organizations)
    .set({
      name: nameInput.trim(),
      updatedAt: unixNow(),
    })
    .where(eq(organizations.id, orgId))
    .returning();

  const updated = updatedRows[0] as OrganizationRecord | undefined;
  if (!updated) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    data: toOrganizationResponse(updated),
  };
}
