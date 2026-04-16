import type { EmailInlineAttachment } from "../types";

export type InlineImageContext = {
  providerMessageId: string;
  mailboxId: number;
  attachments: EmailInlineAttachment[];
};

function normalizeCid(value: string): string {
  return value.trim().replace(/^<|>$/g, "").toLowerCase();
}

function buildInlineAttachmentUrl(
  ctx: InlineImageContext,
  attachment: EmailInlineAttachment,
): string {
  const params = new URLSearchParams({
    providerMessageId: ctx.providerMessageId,
    attachmentId: attachment.attachmentId,
    mailboxId: String(ctx.mailboxId),
    inline: "true",
  });
  if (attachment.mimeType) params.set("mimeType", attachment.mimeType);
  if (attachment.filename) params.set("filename", attachment.filename);
  return `/api/inbox/emails/attachment?${params.toString()}`;
}

/**
 * Rewrite or strip `img[src^="cid:"]` so the browser never fetches an unknown
 * `cid:` URL (which errors as ERR_UNKNOWN_URL_SCHEME). When we have matching
 * inline attachment metadata and the email's identifiers, point the image at
 * the attachment endpoint. Otherwise swap the src for a transparent 1x1 data
 * URI so nothing hits the network and layout is preserved.
 */
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function rewriteCidImages(
  root: ParentNode,
  ctx?: InlineImageContext | null,
): void {
  const imgs = root.querySelectorAll("img");
  if (imgs.length === 0) return;

  const map = new Map<string, EmailInlineAttachment>();
  if (ctx) {
    for (const attachment of ctx.attachments) {
      map.set(normalizeCid(attachment.contentId), attachment);
    }
  }

  imgs.forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || !/^cid:/i.test(src)) return;

    const cid = normalizeCid(src.slice(4));
    const attachment =
      ctx && ctx.providerMessageId && ctx.mailboxId != null
        ? map.get(cid)
        : undefined;

    img.dataset.cid = cid;
    if (attachment) {
      img.setAttribute("src", buildInlineAttachmentUrl(ctx!, attachment));
    } else {
      img.setAttribute("src", TRANSPARENT_PIXEL);
    }
  });
}
