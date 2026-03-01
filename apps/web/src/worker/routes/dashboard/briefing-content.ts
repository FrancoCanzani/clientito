import { and, eq, gt, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  customers,
  customerSummaries,
  emails,
  reminders,
} from "../../db/schema";
import { buildSystemPrompt, getOrgAIContext } from "../../lib/ai-context";
import { truncate } from "../classify/helpers";

export type DashboardBriefingPayload = {
  system: string;
  prompt: string;
  fallbackText: string;
  context: {
    overdueTasks: number;
    pendingTasks: number;
    newCustomerEmails: number;
    atRiskCustomers: number;
  };
};

function buildFallbackBriefing(input: {
  overdueCount: number;
  pendingCount: number;
  newCustomerEmailsCount: number;
  atRiskCustomers: string[];
  overdueMessages: string[];
}): string {
  const lines: string[] = [];

  if (input.overdueCount > 0) {
    lines.push(
      `You have ${input.overdueCount} overdue task${input.overdueCount === 1 ? "" : "s"}.`,
    );
    if (input.overdueMessages.length > 0) {
      lines.push(`Most urgent: ${input.overdueMessages.join("; ")}.`);
    }
  } else {
    lines.push("No overdue tasks right now.");
  }

  lines.push(
    `${input.pendingCount} total pending task${input.pendingCount === 1 ? "" : "s"}.`,
  );

  if (input.newCustomerEmailsCount > 0) {
    lines.push(
      `${input.newCustomerEmailsCount} new customer email${input.newCustomerEmailsCount === 1 ? "" : "s"} in the last 24 hours.`,
    );
  }

  if (input.atRiskCustomers.length > 0) {
    lines.push(`At-risk customers: ${input.atRiskCustomers.join(", ")}.`);
  } else {
    lines.push("No at-risk customers detected.");
  }

  return lines.join(" ");
}

export async function buildDashboardBriefingPayload(input: {
  db: Database;
  orgId: string;
}) {
  const db = input.db;
  const { orgId } = input;
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
        .map((reminder) => truncate(reminder.message, 80))
        .join("; ")}`,
    );
  }

  if (atRiskCustomers.length > 0) {
    contextLines.push(
      `At-risk customers: ${atRiskCustomers
        .slice(0, 5)
        .map((customer) => customer.customerName)
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

  const fallbackText = buildFallbackBriefing({
    overdueCount: overdueReminders.length,
    pendingCount: pendingCount[0]?.count ?? 0,
    newCustomerEmailsCount: newCustomerEmails.length,
    atRiskCustomers: atRiskCustomers
      .slice(0, 5)
      .map((customer) => customer.customerName),
    overdueMessages: overdueReminders
      .slice(0, 3)
      .map((reminder) => truncate(reminder.message, 80)),
  });

  const context = {
    overdueTasks: overdueReminders.length,
    pendingTasks: pendingCount[0]?.count ?? 0,
    newCustomerEmails: newCustomerEmails.length,
    atRiskCustomers: atRiskCustomers.length,
  };

  return {
    system: buildSystemPrompt(basePrompt, aiContext),
    prompt: contextLines.join("\n"),
    fallbackText,
    context,
  } satisfies DashboardBriefingPayload;
}
