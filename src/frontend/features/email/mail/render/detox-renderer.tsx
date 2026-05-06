import { openCompose } from "@/features/email/mail/compose/compose-events";
import { cn } from "@/lib/utils";
import Defuddle from "defuddle";
import DOMPurify from "dompurify";
import { useDeferredValue, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TurndownService from "turndown";
import {
  rewriteCidImages,
  rewriteInsecureImageUrls,
  type InlineImageContext,
} from "../utils/cid-images";
import { parseMailtoComposeInitial } from "../utils/parse-mailto-compose";
import { prepareEmailHtml } from "../utils/prepare-email-html";
import { EmailHtmlRenderer } from "./email-html-renderer";

const MIN_READABLE_CHARS = 40;
const DEFUDDLE_MIN_HTML_LENGTH = 5_000;

const PROSE_SIZE_CLASS: Record<string, string> = {
  sm: "prose-sm",
  base: "prose-base",
  lg: "prose-lg",
  xl: "prose-xl",
};

type DetoxResult = {
  markdown: string;
  textLength: number;
  hasImages: boolean;
  blockedTrackers: number;
  hasQuoted: boolean;
};

type ExtractionStats = {
  textLength: number;
  linkCount: number;
  actionLinkCount: number;
  imageCount: number;
  tableCount: number;
};

function MarkdownImage({
  src,
  alt,
}: {
  src?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="inline-flex min-h-8 items-center rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
        Preview unavailable
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

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

const ACTION_LINK_PATTERN =
  /\b(accept|approve|book|cancel|confirm|download|invoice|join|manage|pay|receipt|reject|reset|review|sign in|track|unsubscribe|verify|view)\b/i;
const LAYOUT_SENSITIVE_TEXT_PATTERN =
  /\b(2fa|boarding pass|confirmation code|login code|one-time code|password reset|security code|ticket|verification code)\b/i;

function isTrackingPixel(img: HTMLImageElement): boolean {
  const width = Number(img.getAttribute("width") ?? "0");
  const height = Number(img.getAttribute("height") ?? "0");
  return (width > 0 && width <= 2) || (height > 0 && height <= 2);
}

function markQuotedBlocks(doc: ParentNode): boolean {
  let found = false;
  const quoted = doc.querySelectorAll(QUOTED_SELECTORS);
  quoted.forEach((el) => {
    el.setAttribute("data-quoted", "true");
    found = true;
  });
  return found;
}

function removeQuotedBlocks(doc: ParentNode): void {
  doc.querySelectorAll("[data-quoted='true']").forEach((el) => el.remove());
}

function processImages(
  doc: Document,
  showImages: boolean,
): {
  hasImages: boolean;
  blockedTrackers: number;
} {
  let blockedTrackers = 0;
  let hasImages = false;
  const images = Array.from(doc.querySelectorAll("img"));
  images.forEach((img) => {
    if (isTrackingPixel(img)) {
      img.remove();
      blockedTrackers += 1;
      return;
    }
    hasImages = true;
    if (!showImages) {
      img.remove();
    }
  });
  return { hasImages, blockedTrackers };
}

function collectExtractionStats(doc: Document): ExtractionStats {
  const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href]"));
  return {
    textLength: text.length,
    linkCount: links.length,
    actionLinkCount: links.filter((link) =>
      ACTION_LINK_PATTERN.test(link.textContent ?? ""),
    ).length,
    imageCount: doc.querySelectorAll("img").length,
    tableCount: doc.querySelectorAll("table").length,
  };
}

function hasTransactionalSignals(doc: Document, stats: ExtractionStats): boolean {
  const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  if (LAYOUT_SENSITIVE_TEXT_PATTERN.test(text)) return true;
  if (stats.actionLinkCount > 1 && stats.textLength < 1200) return true;
  if (stats.tableCount >= 6 && stats.imageCount >= 2 && stats.textLength < 1200) {
    return true;
  }
  return false;
}

function shouldUseExtractedContent(
  sourceDoc: Document,
  extractedHtml: string,
): boolean {
  const sourceStats = collectExtractionStats(sourceDoc);
  if (hasTransactionalSignals(sourceDoc, sourceStats)) return false;

  const extractedDoc = new DOMParser().parseFromString(
    `<html><body>${extractedHtml}</body></html>`,
    "text/html",
  );
  const extractedStats = collectExtractionStats(extractedDoc);
  if (extractedStats.textLength < 180) return false;

  const textRatio =
    sourceStats.textLength > 0
      ? extractedStats.textLength / sourceStats.textLength
      : 1;
  if (textRatio < 0.15 || textRatio > 1.5) return false;

  const retainedLinkRatio =
    sourceStats.linkCount > 0
      ? extractedStats.linkCount / sourceStats.linkCount
      : 1;
  if (sourceStats.linkCount <= 4 && retainedLinkRatio < 0.75) return false;
  if (sourceStats.linkCount > 4 && extractedStats.linkCount < 2) return false;

  return true;
}

function extractReaderContent(doc: Document): string | null {
  try {
    const defuddled = new Defuddle(doc.cloneNode(true) as Document, {
      url: "",
      useAsync: false,
      removeLowScoring: false,
      removeSmallImages: false,
      removePartialSelectors: false,
    }).parse();
    const content = defuddled?.content?.trim();
    if (!content) return null;
    return shouldUseExtractedContent(doc, content) ? content : null;
  } catch {
    // Defuddle can throw on malformed email HTML. Fall back to the sanitized
    // body so we always have something to render.
    return null;
  }
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
  linkStyle: "inlined",
});

turndown.remove(["script", "style", "iframe", "noscript"]);

turndown.addRule("stripEmptyLinks", {
  filter: (node) =>
    node.nodeName === "A" &&
    !(node.textContent ?? "").trim() &&
    !node.querySelector("img"),
  replacement: () => "",
});

function detox(
  rawHtml: string,
  showImages: boolean,
  showQuoted: boolean,
  inlineContext?: InlineImageContext | null,
): DetoxResult {
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

  // Defuddle clones the entire DOM and is the dominant cost of detox. For
  // short HTML the extraction rarely improves the result, so skip it.
  const shouldExtract = rawHtml.length >= DEFUDDLE_MIN_HTML_LENGTH;
  const contentHtml = shouldExtract
    ? extractReaderContent(doc) ?? doc.body.innerHTML
    : doc.body.innerHTML;

  const contentDoc = new DOMParser().parseFromString(
    `<html><body>${contentHtml}</body></html>`,
    "text/html",
  );

  if (hasQuoted) {
    markQuotedBlocks(contentDoc);
  }
  if (!showQuoted) {
    removeQuotedBlocks(contentDoc);
  }

  rewriteCidImages(contentDoc, inlineContext);
  rewriteInsecureImageUrls(contentDoc);
  const { hasImages, blockedTrackers } = processImages(contentDoc, showImages);

  const textLength = (contentDoc.body.textContent ?? "").trim().length;
  const markdown = turndown.turndown(contentDoc.body.innerHTML).trim();

  return { markdown, textLength, hasImages, blockedTrackers, hasQuoted };
}

export function DetoxRenderer({
  html,
  fontSize,
  defaultShowImages,
  inlineContext,
}: {
  html: string;
  fontSize: string;
  defaultShowImages: boolean;
  inlineContext?: InlineImageContext | null;
}) {
  const [showImages, setShowImages] = useState(defaultShowImages);
  const [forceOriginal, setForceOriginal] = useState(false);

  // Defer the heavy detox work so the route can paint before parsing runs.
  const deferredHtml = useDeferredValue(html);
  const result = useMemo(
    () => detox(deferredHtml, showImages, true, inlineContext),
    [deferredHtml, showImages, inlineContext],
  );
  const isEmpty = result.textLength < MIN_READABLE_CHARS;
  const showOriginal = forceOriginal || isEmpty;
  const preparedOriginal = useMemo(
    () => (showOriginal ? prepareEmailHtml(deferredHtml, inlineContext) : ""),
    [showOriginal, deferredHtml, inlineContext],
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
    <div className="min-w-0 max-w-full space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {result.hasImages && !showImages && (
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => setShowImages(true)}
          >
            Show images
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
          "prose prose-neutral dark:prose-invert max-w-none min-w-0 break-words",
          PROSE_SIZE_CLASS[fontSize],
          "prose-headings:font-semibold prose-a:text-foreground prose-a:underline-offset-2",
          "prose-img:rounded-md prose-img:max-w-full prose-img:h-auto",
          "prose-pre:overflow-x-auto prose-pre:max-w-full",
          "[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto",
          "[&_a]:break-all",
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children, ...props }) => {
              const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
                if (!href || !href.toLowerCase().startsWith("mailto:")) return;
                event.preventDefault();
                const composeInitial = parseMailtoComposeInitial(href);
                openCompose(composeInitial ?? undefined);
              };
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClick}
                  {...props}
                >
                  {children}
                </a>
              );
            },
            img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
          }}
        >
          {result.markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
