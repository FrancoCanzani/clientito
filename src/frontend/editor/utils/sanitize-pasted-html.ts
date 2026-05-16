import DOMPurify from "dompurify";

export function sanitizePastedHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style", "class", "id", "onclick", "onload", "onerror"],
  });
}
