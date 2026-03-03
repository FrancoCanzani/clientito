export async function patchEmail(
  emailId: string,
  data: {
    isRead?: boolean;
    archived?: boolean;
    trashed?: boolean;
    starred?: boolean;
  },
): Promise<void> {
  await fetch(`/api/emails/${emailId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function markEmailRead(emailId: string): Promise<void> {
  await patchEmail(emailId, { isRead: true });
}

export async function summarizeEmail(
  emailId: number,
): Promise<{ summary: string }> {
  const response = await fetch("/api/ai/summarize-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailId }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? "Failed to summarize",
    );
  }

  const json = (await response.json()) as { data: { summary: string } };
  return json.data;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
};

export type SendEmailResult = {
  gmailId: string;
  threadId: string;
};

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const response = await fetch("/api/emails/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? "Failed to send email",
    );
  }

  const json = (await response.json()) as { data: SendEmailResult };
  return json.data;
}

export type DraftReplyInput = {
  emailId: number;
  instructions?: string;
};

export type DraftReplyResult = {
  draft: string;
};

export async function draftReply(
  input: DraftReplyInput,
): Promise<DraftReplyResult> {
  const response = await fetch("/api/ai/draft-reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? "Failed to generate draft",
    );
  }

  const json = (await response.json()) as { data: DraftReplyResult };
  return json.data;
}
