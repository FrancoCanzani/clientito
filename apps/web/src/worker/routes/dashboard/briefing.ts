import { generateText } from "ai";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Hono } from "hono";
import {
  customers,
  customerSummaries,
  emails,
  reminders,
} from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import { buildSystemPrompt, getOrgAIContext } from "../../lib/ai-context";
import { getWorkersAIModel, truncate } from "../classify/helpers";
import type { AppRouteEnv } from "../types";

export function registerGetBriefing(app: Hono<AppRouteEnv>) {
  app.get("/briefing", async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const orgId = c.req.query("orgId");
    if (!orgId) return c.json({ error: "orgId required" }, 400);
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const [overdueReminders, atRiskCustomers, newCustomerEmails, pendingCount] =
      await Promise.all([
        db
          .select({ id: reminders.id, message: reminders.message })
          .from(reminders)
          .where(
            and(
              eq(reminders.orgId, orgId),
              eq(reminders.done, false),
              sql`${reminders.dueAt} < ${now}`,
            ),
          ),
        db
          .select({
            customerId: customerSummaries.customerId,
            customerName: customers.name,
          })
          .from(customerSummaries)
          .innerJoin(customers, eq(customerSummaries.customerId, customers.id))
          .where(
            and(
              eq(customerSummaries.orgId, orgId),
              sql`json_extract(${customerSummaries.summary}, '$.status') IN ('at_risk', 'churned')`,
            ),
          )
          .limit(10),
        db
          .select({ id: emails.id })
          .from(emails)
          .where(
            and(
              eq(emails.orgId, orgId),
              eq(emails.isCustomer, true),
              gt(emails.date, oneDayAgo),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(reminders)
          .where(and(eq(reminders.orgId, orgId), eq(reminders.done, false))),
      ]);

    const aiContext = await getOrgAIContext(db, orgId);

    const contextLines = [
      `Overdue tasks: ${overdueReminders.length}`,
      `Pending tasks total: ${pendingCount[0]?.count ?? 0}`,
      `New customer emails (last 24h): ${newCustomerEmails.length}`,
      `At-risk/churned customers: ${atRiskCustomers.length}`,
    ];

    if (overdueReminders.length > 0) {
      contextLines.push(
        `Overdue tasks: ${overdueReminders
          .slice(0, 5)
          .map((r) => truncate(r.message, 80))
          .join("; ")}`,
      );
    }

    if (atRiskCustomers.length > 0) {
      contextLines.push(
        `At-risk customers: ${atRiskCustomers
          .slice(0, 5)
          .map((c) => c.customerName)
          .join(", ")}`,
      );
    }

    const basePrompt = [
      "You are a CRM assistant. Write a short briefing based on the user's current data.",
      "Be direct and specific — mention actual numbers, customer names, and task details when available.",
      "If there's nothing urgent, just say everything looks good.",
      "No bullet points, no headers, no filler.",
      "Plain conversational tone, like a colleague giving a quick update.",
    ].join(" ");

    const { text } = await generateText({
      model: getWorkersAIModel(c.env),
      system: buildSystemPrompt(basePrompt, aiContext),
      prompt: contextLines.join("\n"),
    });

    return c.json({ data: { text } }, 200);
  });
}
