import { openCompose } from "@/features/email/mail/compose/compose-events";
import { parseMailtoComposeInitial } from "@/features/email/mail/utils/parse-mailto-compose";
import { useEffect, useRef } from "react";

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

    shadowRootRef.current.innerHTML = html;
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
