import { getGmailTokenForMailbox } from "../client";
import {
  createGmailLabel,
  listGmailLabels,
} from "./labels";
import type { Database } from "../../../db/client";

export const AWAITING_REPLY_LABEL_NAME = "Duomo/Awaiting reply";

export async function ensureAwaitingReplyLabel(
  db: Database,
  env: Env,
  mailboxId: number,
): Promise<string> {
  const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  });

  const labels = await listGmailLabels(accessToken);
  const existing = labels.find((label) => label.name === AWAITING_REPLY_LABEL_NAME);
  if (existing?.id) return existing.id;

  const created = await createGmailLabel(accessToken, {
    name: AWAITING_REPLY_LABEL_NAME,
  });
  if (!created.id) {
    throw new Error("Failed to create awaiting-reply Gmail label");
  }
  return created.id;
}
