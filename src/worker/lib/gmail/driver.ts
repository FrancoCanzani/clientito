import type { Database } from "../../db/client";
import {
  extractMessageAttachments,
  extractMessageBodyHtml,
  extractMessageBodyText,
  getGmailMessageById,
  getGmailAttachmentBytes,
} from "./mailbox/read";
import {
  sendGmailMessage,
  batchModifyGmailMessages,
  modifyGmailThread,
  hardDeleteGmailMessage,
  batchDeleteGmailMessages,
} from "./mailbox/send";
import {
  createBlockSenderFilter,
  listMessageIdsFromSender,
} from "./mailbox/filters";
import { isGmailReconnectRequiredError } from "./errors";
import type {
  RawMessage,
  SendParams,
  SendResult,
} from "./types";

export class GmailDriver {
  constructor(
    private db: Database,
    private env: Env,
    private mailboxId: number,
  ) {}

  async fetchMessage(messageId: string): Promise<RawMessage> {
    const message = await getGmailMessageById(
      this.db,
      this.env,
      this.mailboxId,
      messageId,
    );

    return {
      bodyText: extractMessageBodyText(message),
      bodyHtml: extractMessageBodyHtml(message),
      attachments: extractMessageAttachments(message),
    };
  }

  async fetchAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<Uint8Array> {
    return getGmailAttachmentBytes(
      this.db,
      this.env,
      this.mailboxId,
      messageId,
      attachmentId,
    );
  }

  async send(fromEmail: string, params: SendParams): Promise<SendResult> {
    const result = await sendGmailMessage(
      this.db,
      this.env,
      this.mailboxId,
      fromEmail,
      params,
    );

    return {
      providerMessageId: result.gmailId,
      threadId: result.threadId,
    };
  }

  async modifyLabels(
    messageIds: string[],
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void> {
    await batchModifyGmailMessages(
      this.db,
      this.mailboxId,
      this.env,
      messageIds,
      addLabelIds,
      removeLabelIds,
    );
  }

  async modifyThreadLabels(
    threadId: string,
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void> {
    await modifyGmailThread(
      this.db,
      this.mailboxId,
      this.env,
      threadId,
      addLabelIds,
      removeLabelIds,
    );
  }

  async hardDelete(messageId: string): Promise<void> {
    await hardDeleteGmailMessage(
      this.db,
      this.mailboxId,
      this.env,
      messageId,
    );
  }

  async hardDeleteBatch(messageIds: string[]): Promise<void> {
    await batchDeleteGmailMessages(
      this.db,
      this.mailboxId,
      this.env,
      messageIds,
    );
  }

  async blockSender(fromEmail: string): Promise<{ trashedCount: number }> {
    await createBlockSenderFilter(
      this.db,
      this.mailboxId,
      this.env,
      fromEmail,
    );
    const ids = await listMessageIdsFromSender(
      this.db,
      this.mailboxId,
      this.env,
      fromEmail,
    );
    if (ids.length > 0) {
      await batchModifyGmailMessages(
        this.db,
        this.mailboxId,
        this.env,
        ids,
        ["TRASH"],
        ["INBOX", "UNREAD"],
      );
    }
    return { trashedCount: ids.length };
  }

  async archiveSender(fromEmail: string): Promise<{ archivedCount: number }> {
    const ids = await listMessageIdsFromSender(
      this.db,
      this.mailboxId,
      this.env,
      fromEmail,
    );
    if (ids.length > 0) {
      await batchModifyGmailMessages(
        this.db,
        this.mailboxId,
        this.env,
        ids,
        [],
        ["INBOX", "UNREAD"],
      );
    }
    return { archivedCount: ids.length };
  }

  isReconnectError(error: unknown): boolean {
    return isGmailReconnectRequiredError(error);
  }
}
