import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { trustEntities } from "../../../db/schema";
import { GmailDriver } from "../../../lib/gmail/driver";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import type { AppRouteEnv } from "../../types";

const resolveBodySchema = z.object({
  mailboxId: z.number().int().positive(),
  senders: z.array(z.string().min(1).max(320)).min(1).max(200),
});

const decisionBodySchema = z.object({
  mailboxId: z.number().int().positive(),
  fromAddr: z.string().min(1).max(320),
  decision: z.enum(["accept", "reject"]),
});

const TRUST_LOOKUP_CHUNK_SIZE = 80;

function normalizeSender(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  return normalized;
}

function getDomain(fromAddr: string): string | null {
  const atIndex = fromAddr.lastIndexOf("@");
  if (atIndex <= 0 || atIndex >= fromAddr.length - 1) return null;
  const domain = fromAddr.slice(atIndex + 1).trim().toLowerCase();
  return domain || null;
}

function chunkValues<T>(values: T[], chunkSize: number): T[][] {
  if (values.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  return chunks;
}

async function selectTrustRowsForEntityType(params: {
  db: AppRouteEnv["Variables"]["db"];
  userId: string;
  mailboxId: number;
  entityType: "sender" | "domain";
  values: string[];
}) {
  if (params.values.length === 0) return [];
  const chunks = chunkValues(params.values, TRUST_LOOKUP_CHUNK_SIZE);
  const rows = await Promise.all(
    chunks.map((chunk) =>
      params.db
        .select({
          entityType: trustEntities.entityType,
          entityValue: trustEntities.entityValue,
          trustLevel: trustEntities.trustLevel,
        })
        .from(trustEntities)
        .where(
          and(
            eq(trustEntities.userId, params.userId),
            eq(trustEntities.mailboxId, params.mailboxId),
            eq(trustEntities.entityType, params.entityType),
            inArray(trustEntities.entityValue, chunk),
          ),
        ),
    ),
  );
  return rows.flat();
}

async function upsertTrustEntity(params: {
  db: AppRouteEnv["Variables"]["db"];
  userId: string;
  mailboxId: number;
  entityType: "sender" | "domain";
  entityValue: string;
  trustLevel: "trusted" | "blocked";
}): Promise<void> {
  const now = Date.now();
  await params.db
    .insert(trustEntities)
    .values({
      userId: params.userId,
      mailboxId: params.mailboxId,
      entityType: params.entityType,
      entityValue: params.entityValue,
      trustLevel: params.trustLevel,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        trustEntities.userId,
        trustEntities.mailboxId,
        trustEntities.entityType,
        trustEntities.entityValue,
      ],
      set: {
        trustLevel: params.trustLevel,
        updatedAt: now,
      },
    });
}

const gatekeeperRoutes = new Hono<AppRouteEnv>();

gatekeeperRoutes.post(
  "/resolve",
  zValidator("json", resolveBodySchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { mailboxId, senders } = c.req.valid("json");

    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

    const normalizedSenders = Array.from(
      new Set(senders.map(normalizeSender).filter((value): value is string => Boolean(value))),
    );

    if (normalizedSenders.length === 0) {
      return c.json({ data: { trust: [] } }, 200);
    }

    const domains = Array.from(
      new Set(
        normalizedSenders
          .map((sender) => getDomain(sender))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const [senderRows, domainRows] = await Promise.all([
      selectTrustRowsForEntityType({
        db,
        userId: user.id,
        mailboxId: mailbox.id,
        entityType: "sender",
        values: normalizedSenders,
      }),
      selectTrustRowsForEntityType({
        db,
        userId: user.id,
        mailboxId: mailbox.id,
        entityType: "domain",
        values: domains,
      }),
    ]);
    const rows = [...senderRows, ...domainRows];

    const senderTrust = new Map<string, "trusted" | "blocked">();
    const domainTrust = new Map<string, "trusted" | "blocked">();

    for (const row of rows) {
      if (row.entityType === "sender") {
        senderTrust.set(row.entityValue, row.trustLevel);
      } else {
        domainTrust.set(row.entityValue, row.trustLevel);
      }
    }

    return c.json(
      {
        data: {
          trust: normalizedSenders.map((sender) => {
            const domain = getDomain(sender);
            const senderLevel = senderTrust.get(sender) ?? null;
            const domainLevel = domain ? (domainTrust.get(domain) ?? null) : null;
            return {
              sender,
              trustLevel: senderLevel ?? domainLevel,
              source: senderLevel ? "sender" : domainLevel ? "domain" : null,
            };
          }),
        },
      },
      200,
    );
  },
);

gatekeeperRoutes.post(
  "/decision",
  zValidator("json", decisionBodySchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { mailboxId, fromAddr, decision } = c.req.valid("json");

    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

    const normalizedSender = normalizeSender(fromAddr);
    if (!normalizedSender) return c.json({ error: "Invalid sender address" }, 400);

    const trustLevel = decision === "accept" ? "trusted" : "blocked";
    await upsertTrustEntity({
      db,
      userId: user.id,
      mailboxId: mailbox.id,
      entityType: "sender",
      entityValue: normalizedSender,
      trustLevel,
    });

    let providerBlocked = false;
    let trashedCount = 0;
    let providerError: string | null = null;
    let requiresReconnect = false;

    if (decision === "reject") {
      try {
        const provider = new GmailDriver(db, c.env, mailbox.id);
        const result = await provider.blockSender(normalizedSender);
        providerBlocked = true;
        trashedCount = result.trashedCount;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to block sender in Gmail";
        providerError = message;
        requiresReconnect = /403|insufficient|scope|permission/i.test(message);
      }
    }

    return c.json(
      {
        data: {
          fromAddr: normalizedSender,
          trustLevel,
          decision,
          providerBlocked,
          trashedCount,
          providerError,
          requiresReconnect,
        },
      },
      200,
    );
  },
);

export default gatekeeperRoutes;
