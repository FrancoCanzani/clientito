import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { organizations } from "../../db/schema";
import { toSlug } from "../../lib/slug";

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
};

export function toOrganizationResponse(record: OrganizationRecord) {
  return {
    ...record,
    id: String(record.id),
  };
}

export function toOrganizationListResponse(row: {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: number;
}) {
  return {
    ...row,
    id: String(row.id),
  };
}

export async function resolveOrganizationNameAndSlug(
  db: Database,
  nameInput: string,
) {
  const name = nameInput.trim();
  const baseSlug = toSlug(name) || "org";

  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });
    if (!existing) {
      break;
    }
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return { name, slug };
}
