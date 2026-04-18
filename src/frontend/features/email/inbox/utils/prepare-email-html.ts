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

  const styleTag = parsedDocument.createElement("style");
  styleTag.textContent = EMAIL_CONTENT_SHADOW_STYLE;

  return `${styleTag.outerHTML}${parsedDocument.body.innerHTML}`;
}
