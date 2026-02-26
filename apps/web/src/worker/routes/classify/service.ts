import { generateText, Output } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client";
import { customers, emails } from "../../db/schema";
import { resolveCustomerName } from "../../lib/customer-name";
import {
  getWorkersAIModel,
  parseAddress,
  runConcurrent,
  toNullableString,
  truncate,
} from "./helpers";

const CLASSIFY_CONCURRENCY = 5;

const classificationSchema = z.object({
  is_customer: z.boolean(),
  name: z.string().nullable(),
  company: z.string().nullable(),
});

const extractionSchema = z.object({
  name: z.string().nullable(),
  company: z.string().nullable(),
});

type ClassificationOutput = z.infer<typeof classificationSchema>;

export type ClassificationBatchResult = {
  processed: number;
  classified: number;
  customerLinked: number;
  failed: number;
};

async function classifyEmailWithAI(
  env: Env,
  input: { from: string; subject: string; body: string },
): Promise<ClassificationOutput | null> {
  const { output } = await generateText({
    model: getWorkersAIModel(env),
    output: Output.object({
      schema: classificationSchema,
      name: "email_classification",
      description: "Customer classification result for a logistics CRM email",
    }),
    system: [
      "You classify emails for a transport/logistics CRM.",
      "Mark is_customer true only for senders requesting transport, quotes, shipment updates, bookings, pickup or delivery coordination.",
      "Mark is_customer false for internal team mail, newsletters, automated notices, spam, and vendors selling services.",
    ].join(" "),
    prompt: [
      `From: ${input.from}`,
      `Subject: ${input.subject}`,
      `Body: ${input.body}`,
    ].join("\n"),
    temperature: 0,
    maxOutputTokens: 150,
  });

  return {
    is_customer: output.is_customer,
    name: toNullableString(output.name),
    company: toNullableString(output.company),
  };
}

export async function extractCustomerFromEmail(
  env: Env,
  from: string,
  subject: string | null,
  body: string | null,
): Promise<{ name: string | null; company: string | null }> {
  const { output } = await generateText({
    model: getWorkersAIModel(env),
    output: Output.object({
      schema: extractionSchema,
      name: "customer_contact_extraction",
      description: "Extract contact name and company from a logistics email",
    }),
    system: "Extract contact name and company from a logistics email.",
    prompt: [
      `From: ${from}`,
      `Subject: ${subject ?? ""}`,
      `Body: ${truncate(body, 1000)}`,
    ].join("\n"),
    temperature: 0,
    maxOutputTokens: 100,
  });

  return {
    name: toNullableString(output.name),
    company: toNullableString(output.company),
  };
}

async function upsertCustomerByEmail(
  db: Database,
  input: { orgId: string; emailAddress: string; name: string | null; company: string | null },
): Promise<string | null> {
  const now = Date.now();
  const resolvedName = resolveCustomerName(input.name, input.emailAddress);

  await db
    .insert(customers)
    .values({
      orgId: input.orgId,
      name: resolvedName,
      company: input.company,
      email: input.emailAddress,
      phone: null,
      notes: "",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [customers.orgId, customers.email] });

  const existing = await db.query.customers.findFirst({
    where: and(eq(customers.orgId, input.orgId), eq(customers.email, input.emailAddress)),
  });

  if (!existing) return null;

  if (input.name || input.company) {
    const nextName = resolveCustomerName(input.name ?? existing.name, input.emailAddress);
    await db
      .update(customers)
      .set({
        name: nextName,
        company: input.company ?? existing.company,
        updatedAt: now,
      })
      .where(eq(customers.id, existing.id));
  }

  return String(existing.id);
}

export async function classifyOrgEmails(
  db: Database,
  env: Env,
  orgId: string,
  limit = 50,
): Promise<ClassificationBatchResult> {
  const pendingEmails = await db
    .select()
    .from(emails)
    .where(and(eq(emails.orgId, orgId), eq(emails.classified, false)))
    .orderBy(asc(emails.createdAt))
    .limit(limit);

  const result: ClassificationBatchResult = {
    processed: 0,
    classified: 0,
    customerLinked: 0,
    failed: 0,
  };

  const classifications = await runConcurrent(
    pendingEmails,
    CLASSIFY_CONCURRENCY,
    async (email) => {
      try {
        return await classifyEmailWithAI(env, {
          from: email.fromAddr,
          subject: truncate(email.subject, 300),
          body: truncate(email.bodyText ?? email.snippet, 1000),
        });
      } catch (error) {
        console.error("Email classification failed", { emailId: email.id, error });
        return null;
      }
    },
  );

  for (let i = 0; i < pendingEmails.length; i++) {
    const email = pendingEmails[i];
    const classification = classifications[i];
    result.processed += 1;

    if (!classification) {
      result.failed += 1;
      continue;
    }

    try {
      let customerId: string | null = null;
      if (classification.is_customer) {
        customerId = await upsertCustomerByEmail(db, {
          orgId,
          emailAddress: parseAddress(email.fromAddr),
          name: classification.name,
          company: classification.company,
        });
        if (customerId) result.customerLinked += 1;
      }

      await db
        .update(emails)
        .set({ isCustomer: classification.is_customer, classified: true, customerId })
        .where(eq(emails.id, email.id));

      result.classified += 1;
    } catch (error) {
      result.failed += 1;
      console.error("Failed to persist classification", { emailId: email.id, error });
    }
  }

  return result;
}
