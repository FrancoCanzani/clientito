import type { Preferences } from "@/features/settings/schema";
import { cn } from "@/lib/utils";
import { Readability } from "@mozilla/readability";
import DOMPurify from "dompurify";
import { useMemo, useState } from "react";
import { prepareEmailHtml } from "../utils/prepare-email-html";
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

const FORBID_ATTR = ["onclick", "onload", "onerror", "style", "class", "id"];

function isTrackingPixel(img: HTMLImageElement): boolean {
  const width = Number(img.getAttribute("width") ?? "0");
  const height = Number(img.getAttribute("height") ?? "0");
  return (width > 0 && width <= 2) || (height > 0 && height <= 2);
}

function markQuotedBlocks(doc: Document): boolean {
  let found = false;
  const quoted = doc.querySelectorAll(
    "blockquote, .gmail_quote, [class*='gmail_quote'], .yahoo_quoted",
  );
  quoted.forEach((el) => {
    el.setAttribute("data-quoted", "true");
    found = true;
  });
  return found;
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

  const article = new Readability(doc.cloneNode(true) as Document, {
    charThreshold: 100,
    keepClasses: false,
  }).parse();

  const contentHtml = article?.content ?? doc.body.innerHTML;

  const contentDoc = new DOMParser().parseFromString(
    `<html><body>${contentHtml}</body></html>`,
    "text/html",
  );

  if (hasQuoted) markQuotedBlocks(contentDoc);
  const { hasImages, blockedTrackers } = processImages(contentDoc, showImages);

  const cleaned = DOMPurify.sanitize(contentDoc.body.innerHTML, {
    USE_PROFILES: { html: true },
    FORBID_TAGS,
    ADD_ATTR: ["data-quoted", "data-blocked"],
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
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>
            {isEmpty
              ? "Couldn't simplify this email."
              : "Showing original email."}
          </span>
          {!isEmpty && (
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => setForceOriginal(false)}
            >
              Back to reader
            </button>
          )}
        </div>
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
        )}
        dangerouslySetInnerHTML={{ __html: result.html }}
      />
    </div>
  );
}
