import { z } from "zod";

export const threadMessageSchema = z.object({
  providerMessageId: z.string().trim().min(1),
  fromAddr: z.string().trim().min(1),
  fromName: z.string().nullable().optional(),
  toAddr: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  bodyText: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
  date: z.number(),
});

export const sentStyleSampleSchema = z.object({
  subject: z.string().nullable().optional(),
  bodyText: z.string().trim().min(1).max(20_000),
});

export function isSelfAuthoredMessage(
  message: ThreadMessageInput | undefined,
  selfEmails: string[],
) {
  if (!message) return false;
  const normalized = new Set(selfEmails.map((email) => email.toLowerCase()));
  return normalized.has(message.fromAddr.toLowerCase());
}

export type ThreadMessageInput = z.infer<typeof threadMessageSchema>;

const quotedReplyLinePatterns = [
  /^On .+ wrote:\s*$/i,
  /^El .+ escribió:\s*$/i,
  /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i,
  /^Begin forwarded message:\s*$/i,
];

function stripQuotedReply(text: string | null | undefined) {
  const normalized = text?.trim() ?? "";
  if (!normalized) return "";

  const lines = normalized.split(/\r?\n/);
  const quotedStartIndex = lines.findIndex((line) =>
    quotedReplyLinePatterns.some((pattern) => pattern.test(line.trim())),
  );

  if (quotedStartIndex <= 0) return normalized;
  return lines.slice(0, quotedStartIndex).join("\n").trim() || normalized;
}

export function getThreadFreshness(messages: ThreadMessageInput[]) {
  const ordered = [...messages].sort((left, right) => left.date - right.date);
  const last = ordered.at(-1);
  return {
    ordered,
    sourceLastMessageId: last?.providerMessageId ?? "",
    sourceMessageCount: ordered.length,
  };
}

export function formatThreadPrompt(messages: ThreadMessageInput[]) {
  return messages
    .map((message) =>
      [
        `From: ${message.fromName ? `${message.fromName} <${message.fromAddr}>` : message.fromAddr}`,
        message.toAddr ? `To: ${message.toAddr}` : null,
        message.subject ? `Subject: ${message.subject}` : null,
        `Date: ${new Date(message.date).toISOString()}`,
        "",
        stripQuotedReply(message.bodyText) || message.snippet?.trim() || "",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    )
    .join("\n\n---\n\n");
}

export function formatStyleSamples(
  samples: Array<z.infer<typeof sentStyleSampleSchema>>,
) {
  return samples
    .map((sample) =>
      [
        sample.subject ? `Subject: ${sample.subject}` : null,
        "",
        stripQuotedReply(sample.bodyText),
      ]
        .filter((line) => line !== null)
        .join("\n"),
    )
    .join("\n\n---\n\n");
}
