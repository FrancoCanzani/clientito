import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { organizations } from "../db/schema";

export async function getOrgAIContext(
  db: Database,
  orgId: string,
): Promise<string | null> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { aiContext: true },
  });
  return org?.aiContext ?? null;
}

export function buildSystemPrompt(
  basePrompt: string,
  aiContext: string | null,
): string {
  if (!aiContext) return basePrompt;
  return `${basePrompt}\n\nBusiness context: ${aiContext}`;
}
