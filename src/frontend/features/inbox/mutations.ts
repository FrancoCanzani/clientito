export async function patchEmail(
  emailId: string,
  data: {
    isRead?: boolean;
    archived?: boolean;
    trashed?: boolean;
    spam?: boolean;
    starred?: boolean;
  },
): Promise<void> {
  const response = await fetch(`/api/emails/${emailId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? "Failed to update email",
    );
  }
}

export async function batchPatchEmails(
  emailIds: string[],
  data: {
    isRead?: boolean;
    archived?: boolean;
    trashed?: boolean;
    spam?: boolean;
    starred?: boolean;
  },
): Promise<void> {
  const response = await fetch("/api/emails/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      emailIds: emailIds.map((id) => Number(id)),
      ...data,
    }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? "Failed to update emails",
    );
  }
}

export async function markEmailRead(emailId: string): Promise<void> {
  await patchEmail(emailId, { isRead: true });
}

type SendEmailInput = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
  attachments?: Array<{ key: string; filename: string; mimeType: string }>;
};

type SendEmailResult = {
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

export async function uploadAttachments(
  files: File[],
): Promise<
  Array<{ key: string; filename: string; mimeType: string; size: number }>
> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("file", file);
  }

  const response = await fetch("/api/emails/attachments", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? "Failed to upload attachments",
    );
  }

  const json = (await response.json()) as {
    data: Array<{
      key: string;
      filename: string;
      mimeType: string;
      size: number;
    }>;
  };
  return json.data;
}

type DraftReplyInput = {
  emailId: number;
  instructions?: string;
};

type DraftReplyResult = {
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
