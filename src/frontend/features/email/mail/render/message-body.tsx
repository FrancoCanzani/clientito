import { memo, useState } from "react";
import type { EmailBodySource } from "../types";
import {
  EmailHtmlRenderer,
  type EmailBodyOverflowMode,
} from "./email-html-renderer";

type PlainTextSections = {
  visibleText: string;
  quotedText: string | null;
};

const QUOTED_REPLY_LINE_PATTERNS = [
  /^On .+ wrote:\s*$/i,
  /^El .+ escribió:\s*$/i,
  /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i,
  /^Begin forwarded message:\s*$/i,
];

function splitPlainTextQuotedContent(text: string): PlainTextSections {
  const normalized = text.trim();
  if (!normalized) {
    return { visibleText: "", quotedText: null };
  }

  const lines = normalized.split(/\r?\n/);
  const quotedStartIndex = lines.findIndex((line) =>
    QUOTED_REPLY_LINE_PATTERNS.some((pattern) => pattern.test(line.trim())),
  );

  if (quotedStartIndex <= 0) {
    return { visibleText: normalized, quotedText: null };
  }

  const visibleText = lines.slice(0, quotedStartIndex).join("\n").trim();
  const quotedText = lines.slice(quotedStartIndex).join("\n").trim();

  if (!visibleText || !quotedText) {
    return { visibleText: normalized, quotedText: null };
  }

  return { visibleText, quotedText };
}

function PlainTextEmailRenderer({ text }: { text: string }) {
  const [showQuotedText, setShowQuotedText] = useState(false);
  const { visibleText, quotedText } = splitPlainTextQuotedContent(text);

  return (
    <div className="space-y-4">
      <div className="whitespace-pre-wrap text-sm leading-6 text-foreground/88">
        {visibleText}
      </div>

      {quotedText && (
        <div className="border border-border/40 bg-muted/35 p-3">
          {!showQuotedText ? (
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowQuotedText(true)}
            >
              Show quoted text
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowQuotedText(false)}
              >
                Hide quoted text
              </button>
              <div className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {quotedText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const MessageBody = memo(function MessageBody({
  detail,
  overflowMode = "contained",
}: {
  detail?: EmailBodySource | null;
  overflowMode?: EmailBodyOverflowMode;
}) {
  const bodyHtml = detail?.resolvedBodyHtml ?? detail?.bodyHtml;
  const bodyText = detail?.resolvedBodyText ?? detail?.bodyText;

  if (bodyHtml) {
    return <EmailHtmlRenderer html={bodyHtml} overflowMode={overflowMode} />;
  }

  if (!bodyText) {
    return null;
  }

  return <PlainTextEmailRenderer text={bodyText} />;
});
