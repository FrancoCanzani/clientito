import { openCompose } from "@/features/email/mail/compose/compose-events";
import { parseMailtoComposeInitial } from "@/features/email/mail/utils/parse-mailto-compose";
import { useEffect, useRef } from "react";

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

 return setupAutoScale(host, content);
 }, [html]);

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
