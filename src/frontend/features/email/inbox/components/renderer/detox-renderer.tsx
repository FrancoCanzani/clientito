import { openCompose } from "@/features/email/inbox/components/compose/compose-events";
import type { Preferences } from "@/features/settings/schema";
import { cn } from "@/lib/utils";
import Defuddle from "defuddle";
import DOMPurify from "dompurify";
import { useMemo, useState } from "react";
import { parseMailtoComposeInitial } from "../../utils/parse-mailto-compose";
import { prepareEmailHtml } from "../../utils/prepare-email-html";
import { EmailHtmlRenderer } from "./email-html-renderer";

const MIN_READABLE_CHARS = 40;

const PROSE_SIZE_CLASS: Record<Preferences["fontSize"], string> = {
  sm: "prose-sm",
  base: "prose-base",
  lg: "prose-lg",
  xl: "prose-xl",
};

type DetoxResult = {
  html: string;
  textLength: number;
  hasImages: boolean;
  blockedTrackers: number;
  hasQuoted: boolean;
};

const FORBID_TAGS = [
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "style",
  "link",
  "meta",
  "iframe",
  "object",
  "embed",
  "video",
  "audio",
  "font",
];

const FORBID_ATTR = ["onclick", "onload", "onerror", "style"];
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

const DARK_COLOR_CANDIDATES = ["color", "text", "link", "vlink", "alink"];

function isTrackingPixel(img: HTMLImageElement): boolean {
  const width = Number(img.getAttribute("width") ?? "0");
  const height = Number(img.getAttribute("height") ?? "0");
  return (width > 0 && width <= 2) || (height > 0 && height <= 2);
}

function markQuotedBlocks(doc: Document): boolean {
  let found = false;
  const quoted = doc.querySelectorAll(QUOTED_SELECTORS);
  quoted.forEach((el) => {
    el.setAttribute("data-quoted", "true");
    found = true;
  });
  return found;
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

function handleTransactionalMail(doc: Document): void {
  doc.querySelectorAll("table").forEach((tableNode) => {
    if (!(tableNode instanceof HTMLTableElement)) return;

    const tableWidth = parseNumericAttr(tableNode.getAttribute("width"));
    const maxColumns = countColumns(tableNode);
    const shouldStackOnNarrow =
      maxColumns > 1 && (tableWidth == null || tableWidth >= 480);

    tableNode.setAttribute("data-transactional-table", "true");
    if (shouldStackOnNarrow) {
      tableNode.setAttribute("data-transactional-stack", "true");
    }

    const cellPadding = parseNumericAttr(tableNode.getAttribute("cellpadding"));
    tableNode
      .querySelectorAll("td,th")
      .forEach((cellNode) => {
        if (
          !(cellNode instanceof HTMLTableCellElement) &&
          !(cellNode instanceof HTMLElement)
        ) {
          return;
        }

        cellNode.setAttribute("data-transactional-cell", "true");
        const cellWidth = parseNumericAttr(cellNode.getAttribute("width"));
        if (cellWidth != null && cellWidth > 340) {
          cellNode.removeAttribute("width");
        }

        if ((cellPadding ?? 0) >= 16) {
          cellNode.setAttribute("data-transactional-tight", "true");
        }
      });

    tableNode.querySelectorAll("img").forEach((img) => {
      img.setAttribute("data-transactional-image", "true");
    });
  });
}

function parseColor(value: string): [number, number, number] | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;

  const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      const r = Number.parseInt(`${hex[0]}${hex[0]}`, 16);
      const g = Number.parseInt(`${hex[1]}${hex[1]}`, 16);
      const b = Number.parseInt(`${hex[2]}${hex[2]}`, 16);
      return [r, g, b];
    }
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  }

  const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) return null;
  const parts = rgbMatch[1]
    .split(",")
    .map((part) => Number.parseFloat(part.trim()))
    .filter((part) => Number.isFinite(part));
  if (parts.length < 3) return null;
  return [
    Math.max(0, Math.min(255, Math.round(parts[0]))),
    Math.max(0, Math.min(255, Math.round(parts[1]))),
    Math.max(0, Math.min(255, Math.round(parts[2]))),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lightenColor(rgb: [number, number, number]): [number, number, number] {
  const target = 235;
  return [
    Math.round(rgb[0] + (target - rgb[0]) * 0.65),
    Math.round(rgb[1] + (target - rgb[1]) * 0.65),
    Math.round(rgb[2] + (target - rgb[2]) * 0.65),
  ];
}

function isDarkModeEnabled(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function lightenDarkText(doc: Document): void {
  if (!isDarkModeEnabled()) return;

  const selectors = DARK_COLOR_CANDIDATES.map((attr) => `[${attr}]`).join(",");
  doc.querySelectorAll<HTMLElement>(selectors).forEach((el) => {
    DARK_COLOR_CANDIDATES.forEach((attr) => {
      const value = el.getAttribute(attr);
      if (!value) return;
      const parsed = parseColor(value);
      if (!parsed) return;
      if (luminance(parsed) >= 0.45) return;
      el.setAttribute(attr, toHex(lightenColor(parsed)));
    });
  });
}

function processImages(doc: Document, showImages: boolean): {
  hasImages: boolean;
  blockedTrackers: number;
} {
  let blockedTrackers = 0;
  let hasImages = false;
  const images = doc.querySelectorAll("img");
  images.forEach((img) => {
    if (isTrackingPixel(img)) {
      img.setAttribute("data-blocked", "true");
      blockedTrackers += 1;
      return;
    }
    hasImages = true;
    if (!showImages) {
      img.setAttribute("data-blocked", "true");
    }
  });
  return { hasImages, blockedTrackers };
}

function detox(rawHtml: string, showImages: boolean): DetoxResult {
  const sanitized = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS,
    FORBID_ATTR,
  });

  const doc = new DOMParser().parseFromString(
    `<html><body>${sanitized}</body></html>`,
    "text/html",
  );

  const hasQuoted = markQuotedBlocks(doc);

  let contentHtml = doc.body.innerHTML;
  try {
    const defuddled = new Defuddle(doc.cloneNode(true) as Document, {
      url: "",
      useAsync: false,
      removeLowScoring: false,
      removeSmallImages: false,
      removePartialSelectors: false,
    }).parse();
    if (defuddled?.content && defuddled.content.trim().length > 0) {
      contentHtml = defuddled.content;
    }
  } catch {
    // Defuddle can throw on malformed email HTML. Fall back to the sanitized
    // body so we always have something to render.
  }

  const contentDoc = new DOMParser().parseFromString(
    `<html><body>${contentHtml}</body></html>`,
    "text/html",
  );

  if (hasQuoted) {
    markQuotedBlocks(contentDoc);
  }
  handleTransactionalMail(contentDoc);
  lightenDarkText(contentDoc);
  const { hasImages, blockedTrackers } = processImages(contentDoc, showImages);

  const cleaned = DOMPurify.sanitize(contentDoc.body.innerHTML, {
    USE_PROFILES: { html: true },
    FORBID_TAGS,
    FORBID_ATTR,
    ADD_ATTR: [
      "data-quoted",
      "data-blocked",
      "data-transactional-table",
      "data-transactional-stack",
      "data-transactional-cell",
      "data-transactional-tight",
      "data-transactional-image",
    ],
  });

  const textLength = (contentDoc.body.textContent ?? "").trim().length;

  return { html: cleaned, textLength, hasImages, blockedTrackers, hasQuoted };
}

export function DetoxRenderer({
  html,
  fontSize,
  defaultShowImages,
  defaultShowQuoted,
}: {
  html: string;
  fontSize: Preferences["fontSize"];
  defaultShowImages: boolean;
  defaultShowQuoted: boolean;
}) {
  const [showImages, setShowImages] = useState(defaultShowImages);
  const [showQuoted, setShowQuoted] = useState(defaultShowQuoted);
  const [forceOriginal, setForceOriginal] = useState(false);

  const result = useMemo(() => detox(html, showImages), [html, showImages]);
  const isEmpty = result.textLength < MIN_READABLE_CHARS;
  const showOriginal = forceOriginal || isEmpty;
  const preparedOriginal = useMemo(
    () => (showOriginal ? prepareEmailHtml(html) : ""),
    [showOriginal, html],
  );

  if (showOriginal) {
    return (
      <div className="space-y-3">
        {forceOriginal && !isEmpty && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => setForceOriginal(false)}
            >
              Back to reader
            </button>
          </div>
        )}
        <EmailHtmlRenderer html={preparedOriginal} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {result.blockedTrackers > 0 && (
          <span>{result.blockedTrackers} tracker blocked</span>
        )}
        {result.hasImages && !showImages && (
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => setShowImages(true)}
          >
            Show images
          </button>
        )}
        {result.hasQuoted && (
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => setShowQuoted((prev) => !prev)}
          >
            {showQuoted ? "Hide quoted text" : "Show quoted text"}
          </button>
        )}
        <button
          type="button"
          className="underline underline-offset-2 hover:text-foreground"
          onClick={() => setForceOriginal(true)}
        >
          Show original
        </button>
      </div>
      <article
        style={{ fontFamily: "var(--reading-font)" }}
        className={cn(
          "prose prose-neutral dark:prose-invert max-w-none",
          PROSE_SIZE_CLASS[fontSize],
          "prose-headings:font-semibold prose-a:text-foreground prose-a:underline-offset-2",
          "prose-img:rounded-md",
          !showQuoted && "[&_[data-quoted='true']]:hidden",
          "[&_[data-blocked='true']]:hidden",
          "[&_[data-transactional-table='true']]:w-full [&_[data-transactional-table='true']]:max-w-full [&_[data-transactional-table='true']]:table-auto",
          "[&_[data-transactional-cell='true']]:align-top [&_[data-transactional-cell='true']]:break-words",
          "[&_[data-transactional-tight='true']]:px-2 [&_[data-transactional-tight='true']]:py-1.5",
          "[&_[data-transactional-image='true']]:h-auto [&_[data-transactional-image='true']]:max-w-full",
          "max-sm:[&_[data-transactional-stack='true']_tr]:block",
          "max-sm:[&_[data-transactional-stack='true']_td]:block max-sm:[&_[data-transactional-stack='true']_td]:w-full",
          "max-sm:[&_[data-transactional-stack='true']_th]:block max-sm:[&_[data-transactional-stack='true']_th]:w-full",
        )}
        onClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const link = target.closest("a");
          if (!link) return;
          const href = link.getAttribute("href");
          if (!href || !href.toLowerCase().startsWith("mailto:")) return;
          event.preventDefault();
          const composeInitial = parseMailtoComposeInitial(href);
          openCompose(composeInitial ?? undefined);
        }}
        dangerouslySetInnerHTML={{ __html: result.html }}
      />
    </div>
  );
}
