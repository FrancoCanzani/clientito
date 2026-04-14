import type { AttachmentMeta } from "../../../lib/gmail/types";

const HAS_ATTACHMENT_LABEL = "HAS_ATTACHMENT";

export function normalizeMimeType(input: string | undefined): string {
  if (!input) return "application/octet-stream";
  const normalized = input.trim().toLowerCase();
  return normalized.includes("/") ? normalized : "application/octet-stream";
}

export function normalizeFilename(input: string | undefined): string | null {
  if (!input) return null;
  const normalized = input.replace(/[\r\n]/g, "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCid(value: string): string {
  return value.trim().replace(/^<|>$/g, "").toLowerCase();
}

export function buildAttachmentUrl(input: {
  providerMessageId: string;
  attachmentId: string;
  filename?: string | null;
  mimeType?: string | null;
  inline?: boolean;
}): string {
  const params = new URLSearchParams({
    providerMessageId: input.providerMessageId,
    attachmentId: input.attachmentId,
  });
  if (input.filename) params.set("filename", input.filename);
  if (input.mimeType) params.set("mimeType", input.mimeType);
  if (input.inline) params.set("inline", "true");
  return `/api/inbox/emails/attachment?${params.toString()}`;
}

export function resolveInlineCidImages(
  html: string,
  providerMessageId: string,
  attachments: AttachmentMeta[],
): string {
  const inlineByCid = new Map<string, AttachmentMeta>();
  for (const attachment of attachments) {
    if (!attachment.contentId) continue;
    inlineByCid.set(normalizeCid(attachment.contentId), attachment);
  }
  if (inlineByCid.size === 0) return html;

  return html.replace(
    /\bsrc\s*=\s*(['"])cid:([^"']+)\1/gi,
    (_match, quote: string, cidValue: string) => {
      const attachment = inlineByCid.get(normalizeCid(cidValue));
      if (!attachment) return `src=${quote}cid:${cidValue}${quote}`;
      const inlineUrl = buildAttachmentUrl({
        providerMessageId,
        attachmentId: attachment.attachmentId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        inline: true,
      });
      return `src=${quote}${inlineUrl}${quote}`;
    },
  );
}

export { HAS_ATTACHMENT_LABEL };
