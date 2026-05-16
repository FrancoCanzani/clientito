import type { EmailAttachment } from "@/features/email/mail/shared/types";

const IMAGE_EXTENSIONS = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "jpg",
  "jpeg",
  "png",
  "svg",
  "webp",
]);

const UNSUPPORTED_IMAGE_EXTENSIONS = new Set(["heic", "heif", "tif", "tiff"]);

const UNSUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/tiff",
]);

export type AttachmentPreviewKind = "image" | "pdf" | "unsupported";

export type AttachmentPreview = {
  kind: AttachmentPreviewKind;
  url: string | null;
};

function getPayloadError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = Reflect.get(payload, "error");
  return typeof error === "string" ? error : null;
}

export async function downloadEmailAttachment(attachment: EmailAttachment) {
  const response = await fetch(attachment.downloadUrl);
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(getPayloadError(payload) ?? "Download failed");
    }

    throw new Error("Download failed");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = attachment.filename || "attachment";
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

export function getAttachmentExtension(filename: string | null): string {
  const extension = filename?.split(".").pop()?.trim().toLowerCase();
  if (!extension || extension === filename?.toLowerCase()) return "";
  return extension;
}

export function getAttachmentLabel(attachment: EmailAttachment): string {
  if (isPdfAttachment(attachment)) return "PDF";
  const extension = getAttachmentExtension(attachment.filename);
  return extension ? extension.slice(0, 4).toUpperCase() : "FILE";
}

export function toInlinePreviewUrl(url: string): string | null {
  if (!url) return null;
  try {
    const next = new URL(url, window.location.origin);
    next.searchParams.set("inline", "true");
    return `${next.pathname}${next.search}`;
  } catch {
    return null;
  }
}

export function isPdfAttachment(attachment: EmailAttachment): boolean {
  const mimeType = attachment.mimeType?.toLowerCase() ?? "";
  if (mimeType === "application/pdf") return true;
  return getAttachmentExtension(attachment.filename) === "pdf";
}

export function isDocumentAttachment(attachment: EmailAttachment): boolean {
  const mimeType = attachment.mimeType?.toLowerCase() ?? "";
  const extension = getAttachmentExtension(attachment.filename);
  return (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    ["doc", "docx", "rtf", "odt"].includes(extension)
  );
}

export function isPreviewableImageAttachment(
  attachment: EmailAttachment,
): boolean {
  const mimeType = attachment.mimeType?.toLowerCase() ?? "";
  const extension = getAttachmentExtension(attachment.filename);

  if (
    UNSUPPORTED_IMAGE_MIME_TYPES.has(mimeType) ||
    UNSUPPORTED_IMAGE_EXTENSIONS.has(extension)
  ) {
    return false;
  }

  if (IMAGE_EXTENSIONS.has(extension)) return true;
  return attachment.isImage && mimeType.startsWith("image/");
}

export function getAttachmentPreview(
  attachment: EmailAttachment,
): AttachmentPreview {
  const inlinePreviewUrl = toInlinePreviewUrl(attachment.downloadUrl);

  if (isPreviewableImageAttachment(attachment)) {
    return {
      kind: "image",
      url: attachment.inlineUrl ?? inlinePreviewUrl,
    };
  }

  if (isPdfAttachment(attachment)) {
    return {
      kind: "pdf",
      url: inlinePreviewUrl,
    };
  }

  return {
    kind: "unsupported",
    url: null,
  };
}

export function getAttachmentBadgeClass(attachment: EmailAttachment): string {
  if (isPdfAttachment(attachment)) {
    return "bg-background text-red-600 dark:text-red-400";
  }
  if (isPreviewableImageAttachment(attachment)) {
    return "bg-background text-orange-500 dark:text-orange-300";
  }
  if (isDocumentAttachment(attachment)) {
    return "bg-background text-blue-600 dark:text-blue-300";
  }
  return "bg-background text-muted-foreground";
}
