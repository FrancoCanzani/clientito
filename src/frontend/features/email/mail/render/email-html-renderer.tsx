import { openCompose } from "@/features/email/mail/compose/compose-events";
import { parseMailtoComposeInitial } from "@/features/email/mail/utils/parse-mailto-compose";
import { useEffect, useRef } from "react";

export function EmailHtmlRenderer({ html }: { html: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  useEffect(() => {
    if (!hostRef.current || shadowRootRef.current) {
      return;
    }
    shadowRootRef.current = hostRef.current.attachShadow({ mode: "open" });
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
    return () => shadowRoot.removeEventListener("click", handleClick);
  }, []);

  return <div ref={hostRef} className="w-full min-w-0 max-w-full" />;
}
