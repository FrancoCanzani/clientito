import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { orgMembers, organizations, users } from "../db/schema";
import { generateId, slugify } from "../lib/slug";

export type AppAuthUser = {
  id: string;
  email: string;
  name: string | null;
  orgs: { orgId: string; orgSlug: string; orgName: string; role: string }[];
};

export async function ensureAppUser(
  db: Database,
  input: { id: string; email: string; name: string | null }
): Promise<void> {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, input.id),
  });

  if (!existing) {
    await db.insert(users).values({
      id: input.id,
      email: input.email,
      name: input.name,
    });
    return;
  }

  if (existing.email !== input.email || existing.name !== input.name) {
    await db
      .update(users)
      .set({
        email: input.email,
        name: input.name,
      })
      .where(eq(users.id, input.id));
  }
}

export async function loadAppAuthUser(db: Database, userId: string): Promise<AppAuthUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) return null;

  const memberships = await db
    .select({
      orgId: orgMembers.orgId,
      role: orgMembers.role,
      orgSlug: organizations.slug,
      orgName: organizations.name,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, userId));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    orgs: memberships,
  };
}

function getDefaultOrgName(input: { name: string | null; email: string }) {
  const preferred = input.name?.trim() || input.email.split("@")[0] || "Organization";
  return `${preferred} Org`;
}

async function getUniqueOrgSlug(db: Database, orgName: string): Promise<string> {
  const base = slugify(orgName) || "organization";

  let attempt = base;
  let suffix = 2;
  while (true) {
    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.slug, attempt),
    });
    if (!existing) return attempt;

    attempt = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function ensureDefaultOrganization(
  db: Database,
  input: { id: string; email: string; name: string | null }
) {
  const membership = await db.query.orgMembers.findFirst({
    where: eq(orgMembers.userId, input.id),
  });
  if (membership) return;

  const orgName = getDefaultOrgName(input);
  const orgId = generateId();
  const slug = await getUniqueOrgSlug(db, orgName);

  await db.batch([
    db.insert(organizations).values({
      id: orgId,
      name: orgName,
      slug,
    }),
    db.insert(orgMembers).values({
      orgId,
      userId: input.id,
      role: "owner",
    }),
  ]);
}
