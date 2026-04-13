import { and, eq, notInArray } from "drizzle-orm";
import type { Database } from "../../../db/client";
import { labels } from "../../../db/schema";
import { getGmailTokenForMailbox } from "../client";
import { listGmailLabels } from "../mailbox/labels";
import type { GoogleOAuthConfig } from "../types";

export async function syncGmailLabels(
  db: Database,
  mailboxId: number,
  userId: string,
  config: GoogleOAuthConfig,
): Promise<void> {
  const accessToken = await getGmailTokenForMailbox(db, mailboxId, config);
  const gmailLabels = await listGmailLabels(accessToken);
  const now = Date.now();

  const syncedGmailIds: string[] = [];

  for (const label of gmailLabels) {
    if (label.type !== "user") continue;

    syncedGmailIds.push(label.id);

    const existing = await db.query.labels.findFirst({
      where: and(eq(labels.mailboxId, mailboxId), eq(labels.gmailId, label.id)),
    });

    if (existing) {
      await db
        .update(labels)
        .set({
          name: label.name,
          textColor: label.color?.textColor ?? null,
          backgroundColor: label.color?.backgroundColor ?? null,
          messagesTotal: label.messagesTotal ?? 0,
          messagesUnread: label.messagesUnread ?? 0,
          syncedAt: now,
        })
        .where(
          and(eq(labels.mailboxId, mailboxId), eq(labels.gmailId, label.id)),
        );
    } else {
      await db.insert(labels).values({
        gmailId: label.id,
        userId,
        mailboxId,
        name: label.name,
        type: label.type,
        textColor: label.color?.textColor ?? null,
        backgroundColor: label.color?.backgroundColor ?? null,
        messagesTotal: label.messagesTotal ?? 0,
        messagesUnread: label.messagesUnread ?? 0,
        syncedAt: now,
      });
    }
  }

  if (syncedGmailIds.length > 0) {
    await db
      .delete(labels)
      .where(
        and(
          eq(labels.mailboxId, mailboxId),
          eq(labels.userId, userId),
          notInArray(labels.gmailId, syncedGmailIds),
        ),
      );
  } else {
    await db
      .delete(labels)
      .where(
        and(eq(labels.mailboxId, mailboxId), eq(labels.userId, userId)),
      );
  }
}
