import DOMPurify from "dompurify";
import { EMAIL_CONTENT_SHADOW_STYLE } from "./email-content-shadow-style";
import {
  rewriteCidImages,
  rewriteInsecureImageUrls,
  type InlineImageContext,
} from "./cid-images";

function isTrackingPixel(img: HTMLImageElement): boolean {
  const width = Number(img.getAttribute("width") ?? "0");
  const height = Number(img.getAttribute("height") ?? "0");
  return (width > 0 && width <= 2) || (height > 0 && height <= 2);
}

function stripTrackingPixels(root: ParentNode): void {
  root.querySelectorAll("img").forEach((img) => {
    if (isTrackingPixel(img)) img.remove();
  });
}

const QUOTED_SELECTORS = [
  "blockquote",
  ".gmail_quote",
  "[class*='gmail_quote']",
  "blockquote.protonmail_quote",
  "[class*='protonmail_quote']",
  "blockquote.tutanota_quote",
  "[class*='tutanota_quote']",
  ".yahoo_quoted",
  "[class*='yahoo_quoted']",
  'div[id="divRplyFwdMsg"]',
].join(", ");

function collapseQuotedBlocks(doc: Document): void {
  const quoted = doc.querySelectorAll<HTMLElement>(QUOTED_SELECTORS);
  quoted.forEach((node) => {
    if (node.closest("[data-quoted-collapsible='true']")) return;
    if (!node.parentNode) return;

    const details = doc.createElement("details");
    details.setAttribute("data-quoted-collapsible", "true");

    const summary = doc.createElement("summary");
    summary.setAttribute("aria-label", "Show quoted text");
    summary.textContent = "...";

    node.parentNode.insertBefore(details, node);
    details.append(summary, node);
  });
}

function parseNumericAttr(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function countColumns(table: HTMLTableElement): number {
  let maxColumns = 0;
  table.querySelectorAll("tr").forEach((row) => {
    let rowCount = 0;
    row.querySelectorAll("th,td").forEach((cell) => {
      const span = parseNumericAttr(cell.getAttribute("colspan")) ?? 1;
      rowCount += Math.max(1, span);
    });
    maxColumns = Math.max(maxColumns, rowCount);
  });
  return maxColumns;
}

function normalizeTransactionalLayout(doc: Document): void {
  doc.querySelectorAll("table").forEach((tableNode) => {
    if (!(tableNode instanceof HTMLTableElement)) return;

    const maxColumns = countColumns(tableNode);

    tableNode.setAttribute("data-transactional-table", "true");
    if (maxColumns >= 8) {
      tableNode.setAttribute("data-transactional-stack", "true");
    }

    const cellPadding = parseNumericAttr(tableNode.getAttribute("cellpadding"));
    tableNode.querySelectorAll("td,th").forEach((cellNode) => {
      if (!(cellNode instanceof HTMLElement)) return;
      cellNode.setAttribute("data-transactional-cell", "true");

      if ((cellPadding ?? 0) >= 16) {
        cellNode.setAttribute("data-transactional-tight", "true");
      }
    });

    tableNode.querySelectorAll("img").forEach((imgNode) => {
      if (!(imgNode instanceof HTMLImageElement)) return;
      imgNode.setAttribute("data-transactional-image", "true");
    });
  });
}

export function prepareEmailHtml(
  html: string,
  inlineContext?: InlineImageContext | null,
): string {
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["form", "input", "button", "select", "textarea"],
  });
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(sanitized, "text/html");

  for (const link of parsedDocument.querySelectorAll<HTMLAnchorElement>(
    "a[href]",
  )) {
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("http://") || href.startsWith("https://")) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  }

  rewriteCidImages(parsedDocument, inlineContext);
  rewriteInsecureImageUrls(parsedDocument);
  stripTrackingPixels(parsedDocument);
  normalizeTransactionalLayout(parsedDocument);
  collapseQuotedBlocks(parsedDocument);

  const styleTag = parsedDocument.createElement("style");
  styleTag.textContent = EMAIL_CONTENT_SHADOW_STYLE;

  return `${styleTag.outerHTML}${parsedDocument.body.innerHTML}`;
}
