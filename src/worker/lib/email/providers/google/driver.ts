import type { Database } from "../../../../db/client";
import {
  extractMessageAttachments,
  extractMessageBodyHtml,
  extractMessageBodyText,
  getGmailMessageById,
  getGmailAttachmentBytes,
  sendGmailMessage,
  batchModifyGmailMessages,
} from "./mailbox";
import { isGmailReconnectRequiredError } from "./errors";
import { catchUpAllMailboxes, syncGmailMessageIds } from "./sync";
import type {
  EmailProvider,
  RawMessage,
  SendParams,
  SendResult,
} from "../../types";

export class GmailDriver implements EmailProvider {
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

  async syncMessages(userId: string): Promise<void> {
    await catchUpAllMailboxes(this.db, this.env, userId);
  }

  async syncMessageIds(
    userId: string,
    messageIds: string[],
    forceFull?: boolean,
  ): Promise<void> {
    await syncGmailMessageIds(
      this.db,
      this.env,
      this.mailboxId,
      userId,
      messageIds,
      forceFull,
    );
  }

  isReconnectError(error: unknown): boolean {
    return isGmailReconnectRequiredError(error);
  }
}
