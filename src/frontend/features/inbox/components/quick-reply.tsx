import { ArrowBendUpLeftIcon } from "@phosphor-icons/react";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComposeInitial, EmailDetailItem, EmailListItem } from "../types";
import { formatQuotedDate } from "../utils/formatters";
import { ComposeEmailFields } from "./compose-email-fields";
import { useComposeEmail } from "./compose-email-state";

export type QuickReplyHandle = {
  scrollIntoViewAndFocus: () => void;
};

function buildReplyInitial(
  email: EmailListItem,
  detail?: EmailDetailItem | null,
): ComposeInitial {
  const subject = email.subject
    ? `Re: ${email.subject.replace(/^Re:\s*/i, "")}`
    : "Re:";

  const originalFrom = email.fromName
    ? `${email.fromName} &lt;${email.fromAddr}&gt;`
    : email.fromAddr;
  const originalDate = formatQuotedDate(email.date);
  const originalBody =
    detail?.resolvedBodyHtml ?? detail?.resolvedBodyText ?? email.snippet ?? "";
  const quotedHtml = `<br><div style="border-left:2px solid #ccc;padding-left:12px;margin-left:0;color:#555">On ${originalDate}, ${originalFrom} wrote:<br>${originalBody}</div>`;

  return {
    mailboxId: email.mailboxId,
    to: email.fromAddr,
    subject,
    body: quotedHtml,
    threadId: email.threadId ?? undefined,
  };
}

export const QuickReply = forwardRef<
  QuickReplyHandle,
  { email: EmailListItem; detail?: EmailDetailItem | null }
>(function QuickReply({ email, detail }, ref) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initial = useMemo(
    () => buildReplyInitial(email, detail),
    [email, detail],
  );

  const compose = useComposeEmail(initial, {
    onSent: () => setOpen(false),
  });

  useImperativeHandle(ref, () => ({
    scrollIntoViewAndFocus: () => {
      setOpen(true);
      setTimeout(() => {
        containerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }, 50);
    },
  }));

  if (!open) {
    return (
      <div ref={containerRef} className="mt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-md border border-border/50 p-4 justify-center text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Click here to reply
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mt-6">
      <div className="rounded-md border border-border overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2">
          <ArrowBendUpLeftIcon className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Reply</span>
        </div>
        <ComposeEmailFields
          compose={compose}
          bodyClassName="min-h-32 text-sm leading-relaxed"
          onEscape={() => setOpen(false)}
          editorAutoFocus
        />
      </div>
    </div>
  );
});
