import type { ComposeInitial } from "../types";

function decodeMailtoPart(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const decoded = decodeURIComponent(value.replace(/\+/g, " ")).trim();
    return decoded.length > 0 ? decoded : undefined;
  } catch {
    return value.trim().length > 0 ? value.trim() : undefined;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>") || "<br>"}</p>`,
    )
    .join("");
}

export function parseMailtoComposeInitial(href: string): ComposeInitial | null {
  if (!href.toLowerCase().startsWith("mailto:")) {
    return null;
  }

  const rawTarget = href.slice(7);
  const [toPart, queryPart = ""] = rawTarget.split("?");
  const params = new URLSearchParams(queryPart);
  const body = decodeMailtoPart(params.get("body"));

  return {
    to: decodeMailtoPart(toPart),
    cc: decodeMailtoPart(params.get("cc")),
    bcc: decodeMailtoPart(params.get("bcc")),
    subject: decodeMailtoPart(params.get("subject")),
    bodyHtml: body ? plainTextToHtml(body) : undefined,
  };
}
