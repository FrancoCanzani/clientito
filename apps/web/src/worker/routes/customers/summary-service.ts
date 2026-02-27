import { generateText, Output } from "ai";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { createDb } from "../../db/client";
import {
  customers,
  customerSummaries,
  emails,
  reminders,
} from "../../db/schema";
import { getWorkersAIModel, truncate } from "../classify/helpers";

export const customerHealthSchema = z.object({
  status: z.enum(["healthy", "at_risk", "churned", "new", "unknown"]),
  keyChanges: z.array(z.string()).max(3),
  risks: z.array(z.string()).max(3),
  nextBestAction: z.string(),
  confidence: z.number().min(0).max(1),
});

export type CustomerHealth = z.infer<typeof customerHealthSchema>;

type Db = ReturnType<typeof createDb>;

export async function generateAndStoreSummary(
  db: Db,
  env: Env,
  customerId: string,
  orgId: string,
  triggerReason?: string,
): Promise<CustomerHealth> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer) throw new Error(`Customer ${customerId} not found`);

  const recentEmails = await db
    .select({
      subject: emails.subject,
      snippet: emails.snippet,
      date: emails.date,
      fromAddr: emails.fromAddr,
    })
    .from(emails)
    .where(eq(emails.customerId, customerId))
    .orderBy(desc(emails.date))
    .limit(10);

  const pendingReminders = await db
    .select({
      message: reminders.message,
      dueAt: reminders.dueAt,
    })
    .from(reminders)
    .where(
      sql`${reminders.customerId} = ${customerId} AND ${reminders.done} = 0`,
    );

  const emailContext = recentEmails
    .map(
      (e) =>
        `[${new Date(e.date).toISOString().slice(0, 10)}] From: ${e.fromAddr} | Subject: ${truncate(e.subject, 80)} | ${truncate(e.snippet, 120)}`,
    )
    .join("\n");

  const reminderContext = pendingReminders
    .map(
      (r) =>
        `Due ${new Date(r.dueAt).toISOString().slice(0, 10)}: ${truncate(r.message, 100)}`,
    )
    .join("\n");

  const model = getWorkersAIModel(env);

  const { output } = await generateText({
    model,
    output: Output.object({ schema: customerHealthSchema }),
    system:
      "Analyze a logistics CRM customer's activity. Return JSON with: status (healthy/at_risk/churned/new/unknown), keyChanges (up to 3 recent changes), risks (up to 3), nextBestAction (one concrete action), confidence (0-1).",
    prompt: `Customer: ${customer.name} (${customer.email})${customer.company ? ` at ${customer.company}` : ""}

Recent emails (${recentEmails.length}):
${emailContext || "None"}

Pending reminders:
${reminderContext || "None"}`,
  });

  const health = output as CustomerHealth;

  await db.insert(customerSummaries).values({
    customerId,
    orgId,
    summary: JSON.stringify(health),
    generatedAt: Date.now(),
    triggerReason: triggerReason ?? null,
  });

  return health;
}

export async function findCustomersNeedingSummary(
  db: Db,
  orgId: string,
): Promise<{ id: string; name: string }[]> {
  const rows = await db.all<{ id: string; name: string }>(sql`
    SELECT c.id, c.name
    FROM customers c
    LEFT JOIN (
      SELECT customer_id, MAX(generated_at) as latest_generated
      FROM customer_summaries
      GROUP BY customer_id
    ) cs ON cs.customer_id = c.id
    LEFT JOIN (
      SELECT customer_id, MAX(date) as latest_email
      FROM emails
      WHERE customer_id IS NOT NULL
      GROUP BY customer_id
    ) e ON e.customer_id = c.id
    WHERE c.org_id = ${orgId}
      AND (cs.latest_generated IS NULL OR e.latest_email > cs.latest_generated)
  `);
  return rows;
}
