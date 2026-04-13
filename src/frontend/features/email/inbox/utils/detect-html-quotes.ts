/**
 * Multi-provider quote detection for HTML emails.
 *
 * Detects quoted/replied content from Gmail, ProtonMail, Tutanota,
 * Yahoo, Outlook, Apple Mail, and generic blockquotes, then wraps
 * the first match in a collapsible container.
 */

const QUOTE_SELECTORS = [
  "div.gmail_quote",
  "div.gmail_extra",
  "blockquote.protonmail_quote",
  "blockquote.tutanota_quote",
  "div.yahoo_quoted",
  'div[id*="divRplyFwdMsg"]',
  'blockquote[type="cite"]',
] as const;

const COMBINED_SELECTOR = QUOTE_SELECTORS.join(", ");

/**
 * Finds the first quoted-reply block in the document, wraps it in a
 * collapsible container, and injects a toggle button before it.
 *
 * All DOM mutations happen on the passed-in Document (from DOMParser),
 * not the live page document.
 */
export function detectAndWrapHtmlQuotes(doc: Document): { hasQuote: boolean } {
  const quote = doc.body.querySelector(COMBINED_SELECTOR);
  if (!quote) {
    return { hasQuote: false };
  }

  // Wrap the quote element in a container
  const wrapper = doc.createElement("div");
  wrapper.setAttribute("data-quote-collapsed", "");
  wrapper.style.display = "none";

  quote.parentNode?.insertBefore(wrapper, quote);
  wrapper.appendChild(quote);

  // Inject toggle button before the wrapper
  const toggle = doc.createElement("button");
  toggle.setAttribute("data-quote-toggle", "");
  toggle.setAttribute("type", "button");
  toggle.textContent = "Show quoted text";

  wrapper.parentNode?.insertBefore(toggle, wrapper);

  return { hasQuote: true };
}

/** CSS injected into the shadow DOM for quote toggle styling. */
export const QUOTE_SHADOW_STYLES = `
  [data-quote-toggle] {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 8px 0 4px;
    padding: 4px 10px;
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 6px;
    background: rgba(128, 128, 128, 0.06);
    color: rgba(128, 128, 128, 0.7);
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  [data-quote-toggle]:hover {
    background: rgba(128, 128, 128, 0.12);
    color: inherit;
  }
`;
