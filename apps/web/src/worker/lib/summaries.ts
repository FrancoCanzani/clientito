import type { createDb } from "../db/client";
import { syncState } from "../db/schema";
import { runConcurrent } from "../routes/classify/helpers";
import {
  findCustomersNeedingSummary,
  generateAndStoreSummary,
} from "../routes/customers/summary-service";

type Db = ReturnType<typeof createDb>;

export async function runScheduledSummaryGeneration(
  db: Db,
  env: Env,
): Promise<void> {
  const orgs = await db
    .selectDistinct({ orgId: syncState.orgId })
    .from(syncState);

  for (const { orgId } of orgs) {
    try {
      const needsSummary = await findCustomersNeedingSummary(db, orgId);
      if (needsSummary.length === 0) continue;

      console.log(
        `[summaries] org=${orgId}: ${needsSummary.length} customers need summary`,
      );

      await runConcurrent(needsSummary, 2, async (customer) => {
        try {
          await generateAndStoreSummary(
            db,
            env,
            customer.id,
            orgId,
            "scheduled",
          );
          console.log(
            `[summaries] generated for customer=${customer.id} (${customer.name})`,
          );
        } catch (err) {
          console.error(`[summaries] failed for customer=${customer.id}:`, err);
        }
      });
    } catch (err) {
      console.error(`[summaries] failed for org=${orgId}:`, err);
    }
  }
}
