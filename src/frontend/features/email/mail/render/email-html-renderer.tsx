import { openCompose } from "@/features/email/mail/compose/compose-events";
import { parseMailtoComposeInitial } from "@/features/email/mail/utils/parse-mailto-compose";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useRef } from "react";

type Rgb = { r: number; g: number; b: number };

const DARK_MODE_BACKGROUND: Rgb = { r: 20, g: 20, b: 20 };
const DEFAULT_LINK_COLOR = "#93c5fd";

const EMAIL_CONTENT_SHADOW_STYLE = `
 :host {
 display: block;
 width: 100%;
 max-width: 100%;
 color: inherit;
 font-family: inherit;
 font-size: 12px;
 line-height: 1.45;
 overflow-x: auto;
 overflow-y: hidden;
 -webkit-overflow-scrolling: touch;
 overflow-wrap: normal;
 word-break: normal;
 }
 *, *::before, *::after { box-sizing: border-box; }
 :host > * { max-width: 100%; }
 p, div, span, li, blockquote, pre {
 overflow-wrap: anywhere;
 word-break: break-word;
 }
 td, th { overflow-wrap: normal; word-break: normal; }
 table { border-collapse: collapse; table-layout: auto; max-width: none !important; }
 [data-transactional-table='true'] { max-width: none !important; table-layout: auto !important; }
 [data-transactional-cell='true'] { vertical-align: top; overflow-wrap: normal; word-break: normal; }
 [data-transactional-tight='true'] { padding: 6px 8px !important; }
 [data-transactional-image='true'] { max-width: 100% !important; height: auto !important; }
 img, video, iframe, svg, canvas { max-width: 100% !important; height: auto !important; }
 img[data-image-error='true'] {
 display: inline-flex !important;
 min-width: 120px;
 min-height: 32px;
 border: 1px solid #d4d4d8;
 border-radius: 6px;
 background: #f4f4f5;
 color: transparent;
 vertical-align: middle;
 }
 pre { white-space: pre-wrap; max-width: 100%; overflow-x: auto; }
 details[data-quoted-collapsible='true'] { margin: 8px 0; }
 details[data-quoted-collapsible='true'] > summary {
 list-style: none;
 cursor: pointer;
 user-select: none;
 color: #6b7280;
 font-size: 12px;
 font-weight: 600;
 }
 details[data-quoted-collapsible='true'] > summary::-webkit-details-marker { display: none; }
 details[data-quoted-collapsible='true'][open] > summary { margin-bottom: 8px; }
 [data-email-scale-viewport='true'] { width: 100%; max-width: 100%; min-width: 0; overflow: hidden; }
 [data-email-scale-content='true'] {
 display: block;
 width: 100%;
 max-width: none;
 transform-origin: top left;
 }
`;

function parseCssColor(color: string): { rgb: Rgb; alpha: number } | null {
 const rgba = color.match(
 /^rgba?\(\s*([.\d]+)\s*,\s*([.\d]+)\s*,\s*([.\d]+)(?:\s*,\s*([.\d]+))?\s*\)$/i,
 );
 if (!rgba) return null;
 const r = Number(rgba[1]);
 const g = Number(rgba[2]);
 const b = Number(rgba[3]);
 const alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
 if (![r, g, b, alpha].every(Number.isFinite)) return null;
 return { rgb: { r, g, b }, alpha };
}

function blendOverBackground(foreground: Rgb, alpha: number, background: Rgb): Rgb {
 return {
 r: foreground.r * alpha + background.r * (1 - alpha),
 g: foreground.g * alpha + background.g * (1 - alpha),
 b: foreground.b * alpha + background.b * (1 - alpha),
 };
}

function relativeLuminance({ r, g, b }: Rgb): number {
 const channel = (value: number) => {
 const normalized = value / 255;
 return normalized <= 0.03928
 ? normalized / 12.92
 : ((normalized + 0.055) / 1.055) ** 2.4;
 };
 return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
 const l1 = relativeLuminance(a);
 const l2 = relativeLuminance(b);
 const lighter = Math.max(l1, l2);
 const darker = Math.min(l1, l2);
 return (lighter + 0.05) / (darker + 0.05);
}

function hasVisibleDirectText(element: Element): boolean {
 return Array.from(element.childNodes).some(
 (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
 );
}

function hasCustomBackground(element: Element): boolean {
 const parsed = parseCssColor(window.getComputedStyle(element).backgroundColor);
 return Boolean(parsed && parsed.alpha > 0.02);
}

function getReadableDarkModeColor(color: Rgb): string {
 if (contrastRatio(color, DARK_MODE_BACKGROUND) >= 4.5) {
 return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
 }

 const huePreserved = { ...color };
 for (let i = 0; i < 14; i += 1) {
 huePreserved.r = Math.min(255, huePreserved.r + 16);
 huePreserved.g = Math.min(255, huePreserved.g + 16);
 huePreserved.b = Math.min(255, huePreserved.b + 16);
 if (contrastRatio(huePreserved, DARK_MODE_BACKGROUND) >= 4.5) {
 return `rgb(${Math.round(huePreserved.r)}, ${Math.round(huePreserved.g)}, ${Math.round(huePreserved.b)})`;
 }
 }

 return "#e5e5e5";
}

function lightenUnreadableText(root: ParentNode): void {
 const walk = (element: Element) => {
 if (hasCustomBackground(element)) return;

 const computed = window.getComputedStyle(element);
 const parsedColor = parseCssColor(computed.color);
 if (parsedColor && hasVisibleDirectText(element)) {
 const color =
 parsedColor.alpha < 1
 ? blendOverBackground(parsedColor.rgb, parsedColor.alpha, DARK_MODE_BACKGROUND)
 : parsedColor.rgb;

 if (contrastRatio(color, DARK_MODE_BACKGROUND) < 4.5) {
 (element as HTMLElement).style.color =
 element.tagName === "A" ? DEFAULT_LINK_COLOR : getReadableDarkModeColor(color);
 }
 }

 for (const child of Array.from(element.children)) {
 walk(child);
 }
 };

 for (const child of Array.from(root.children)) {
 walk(child);
 }
}

function wrapEmailContent(shadowRoot: ShadowRoot): HTMLElement | null {
 const viewport = document.createElement("div");
 viewport.setAttribute("data-email-scale-viewport", "true");

 const content = document.createElement("div");
 content.setAttribute("data-email-scale-content", "true");

 const contentNodes = Array.from(shadowRoot.childNodes).filter(
 (node) => !(node instanceof HTMLStyleElement),
 );

 if (contentNodes.length === 0) {
 return null;
 }

 for (const node of contentNodes) {
 content.append(node);
 }

 viewport.append(content);
 shadowRoot.append(viewport);
 return content;
}

function setupAutoScale(host: HTMLElement, content: HTMLElement): () => void {
 const viewport = content.parentElement;
 if (!viewport) return () => {};

 let animationFrame = 0;

 const scaleContent = () => {
 animationFrame = 0;

 content.style.removeProperty("width");
 content.style.removeProperty("transform");
 content.removeAttribute("data-email-scaled");
 viewport.style.removeProperty("height");

 const availableWidth = Math.floor(viewport.clientWidth || host.clientWidth);
 const contentWidth = Math.ceil(content.scrollWidth);

 if (availableWidth <= 0 || contentWidth <= availableWidth + 1) {
 return;
 }

 const scale = availableWidth / contentWidth;
 content.style.width = `${contentWidth}px`;
 content.style.transform = `scale(${scale})`;
 content.setAttribute("data-email-scaled", "true");
 viewport.style.height = `${Math.ceil(content.scrollHeight * scale)}px`;
 };

 const scheduleScale = () => {
 if (animationFrame) cancelAnimationFrame(animationFrame);
 animationFrame = requestAnimationFrame(scaleContent);
 };

 const resizeObserver = new ResizeObserver(scheduleScale);
 resizeObserver.observe(host);

 content.addEventListener("load", scheduleScale, true);
 content.addEventListener("error", scheduleScale, true);
 scheduleScale();

 return () => {
 if (animationFrame) cancelAnimationFrame(animationFrame);
 resizeObserver.disconnect();
 content.removeEventListener("load", scheduleScale, true);
 content.removeEventListener("error", scheduleScale, true);
 };
}

export function EmailHtmlRenderer({ html }: { html: string }) {
 const hostRef = useRef<HTMLDivElement | null>(null);
 const shadowRootRef = useRef<ShadowRoot | null>(null);
 const { resolved: theme } = useTheme();

 useEffect(() => {
 const host = hostRef.current;
 if (!host || shadowRootRef.current) {
 return;
 }
 shadowRootRef.current =
 host.shadowRoot ?? host.attachShadow({ mode: "open" });
 }, []);

 useEffect(() => {
 if (!shadowRootRef.current) {
 return;
 }

 const shadowRoot = shadowRootRef.current;
 const host = hostRef.current;
 shadowRoot.innerHTML = `<style>${EMAIL_CONTENT_SHADOW_STYLE}</style>${html}`;

 const content = wrapEmailContent(shadowRoot);
 if (!host || !content) {
 return;
 }

 if (theme === "dark") {
 lightenUnreadableText(content);
 }

 return setupAutoScale(host, content);
 }, [html, theme]);

 useEffect(() => {
 if (!shadowRootRef.current) {
 return;
 }

 const shadowRoot = shadowRootRef.current;
 const handleClick = (event: Event) => {
 const target = event.target;
 if (!(target instanceof Element)) {
 return;
 }

 const link = target.closest("a");
 if (!link) {
 return;
 }

 const href = link.getAttribute("href");
 if (!href) {
 return;
 }

 if (href.toLowerCase().startsWith("mailto:")) {
 event.preventDefault();
 const composeInitial = parseMailtoComposeInitial(href);
 openCompose(composeInitial ?? undefined);
 return;
 }

 if (href.startsWith("http://") || href.startsWith("https://")) {
 event.preventDefault();
 window.open(href, "_blank", "noopener,noreferrer");
 }
 };

 shadowRoot.addEventListener("click", handleClick);
 const handleImageError = (event: Event) => {
 const target = event.target;
 if (!(target instanceof HTMLImageElement)) return;
 target.setAttribute("data-image-error", "true");
 target.removeAttribute("src");
 target.setAttribute("alt", target.alt || "Preview unavailable");
 };

 shadowRoot.addEventListener("error", handleImageError, true);
 return () => {
 shadowRoot.removeEventListener("click", handleClick);
 shadowRoot.removeEventListener("error", handleImageError, true);
 };
 }, []);

 return <div ref={hostRef} className="w-full min-w-0 max-w-full" />;
}
