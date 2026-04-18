import { createDb } from "../db/client";
import { batchModifyGmailMessages } from "../lib/gmail/mailbox/send";

export type EmailLabelMutationMessage = {
  mailboxId: number;
  providerMessageIds: string[];
  addLabelIds: string[];
  removeLabelIds: string[];
};

export async function handleEmailLabelMutations(
  batch: MessageBatch<EmailLabelMutationMessage>,
  env: Env,
): Promise<void> {
  const db = createDb(env.DB);

  for (const msg of batch.messages) {
    const { mailboxId, providerMessageIds, addLabelIds, removeLabelIds } = msg.body;
    try {
      await batchModifyGmailMessages(db, mailboxId, env, providerMessageIds, addLabelIds, removeLabelIds);
      msg.ack();
    } catch (error) {
      console.error("Email label mutation failed, will retry", {
        mailboxId,
        providerMessageIds,
        error: error instanceof Error ? error.message : String(error),
      });
      msg.retry();
    }
  }
}
