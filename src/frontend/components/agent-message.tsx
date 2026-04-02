import { Button } from "@/components/ui/button";
import {
  getComposerBody,
  isComposerOpen,
  setComposerBody,
} from "@/features/inbox/components/compose-bridge";
import { fetchEmailDetail } from "@/features/inbox/queries";
import type { EmailDetailItem } from "@/features/inbox/types";
import { normalizeAgentText } from "@/lib/normalize-agent-text";
import { cn } from "@/lib/utils";
import { CheckIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { isReasoningUIPart, isToolUIPart, type UIMessage } from "ai";
import { diffWords } from "diff";
import DOMPurify from "dompurify";
import { useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const toolLabels: Record<string, string> = {
  createTask: "Create task",
  archiveEmail: "Archive email",
  batchArchive: "Archive emails",
  trashEmail: "Trash email",
  batchTrash: "Trash emails",
  snoozeEmail: "Snooze email",
  unsubscribeEmail: "Unsubscribe",
  sendEmail: "Send email",
  composeEmail: "Compose email",
  searchEmails: "Search emails",
  resolveContact: "Look up contact",
  listTasks: "List tasks",
  summarizeEmail: "Summarize email",
  getEmail: "Read email",
  approveProposedEvent: "Approve event",
  dismissProposedEvent: "Dismiss event",
};

function humanizeToolName(toolName: string): string {
  return toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function isPresent(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function formatGenericValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function formatDueAt(value: unknown): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function ToolField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "space-y-1.5" : "flex gap-2"}>
      <p className="shrink-0 text-[11px] font-medium text-muted-foreground">
        {label}
      </p>
      <div
        className={
          multiline
            ? "text-xs text-foreground"
            : "min-w-0 text-xs text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}

function ToolBodyPreview({ text }: { text: string }) {
  const looksLikeHtml = /<([a-z][\w-]*)\b[^>]*>/i.test(text);

  if (looksLikeHtml) {
    const sanitized = useMemo(
      () =>
        DOMPurify.sanitize(text, {
          USE_PROFILES: { html: true },
        }),
      [text],
    );

    return (
      <div className="max-h-48 overflow-y-auto rounded-md border border-border/60 bg-background px-3 py-2">
        <div
          className={cn("prose prose-sm max-w-none text-xs text-foreground")}
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      </div>
    );
  }

  return (
    <div className="max-h-48 overflow-y-auto rounded-md border border-border/60 bg-background px-3 py-2">
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildForwardedEmailPreviewHtml(email: EmailDetailItem) {
  const fromLine = email.fromName
    ? `${escapeHtml(email.fromName)} &lt;${escapeHtml(email.fromAddr)}&gt;`
    : escapeHtml(email.fromAddr);
  const dateLine = new Date(email.date).toLocaleString();
  const subjectLine = escapeHtml(email.subject ?? "(no subject)");
  const toLine = email.toAddr?.trim() ? escapeHtml(email.toAddr) : null;
  const ccLine = email.ccAddr?.trim() ? escapeHtml(email.ccAddr) : null;
  const originalBody = email.resolvedBodyHtml?.trim().length
    ? email.resolvedBodyHtml
    : `<div style="white-space:pre-wrap">${escapeHtml(email.resolvedBodyText ?? "")}</div>`;

  return [
    "<p><br></p>",
    '<div data-forwarded-message="true" style="border-top:1px solid #dadce0;margin-top:16px;padding-top:16px;color:#5f6368;font-size:13px">',
    '<div data-forwarded-header="true">---------- Forwarded message ---------</div>',
    `<div><strong>From:</strong> ${fromLine}</div>`,
    `<div><strong>Date:</strong> ${escapeHtml(dateLine)}</div>`,
    `<div><strong>Subject:</strong> ${subjectLine}</div>`,
    ...(toLine ? [`<div><strong>To:</strong> ${toLine}</div>`] : []),
    ...(ccLine ? [`<div><strong>Cc:</strong> ${ccLine}</div>`] : []),
    "<br>",
    `<div data-forwarded-original-body="true">${originalBody}</div>`,
    "</div>",
  ].join("");
}

function EmailActionArgs({ args }: { args: Record<string, unknown> }) {
  const forwardEmailId =
    typeof args.forwardEmailId === "number"
      ? String(args.forwardEmailId)
      : null;
  const forwardEmailQuery = useQuery({
    queryKey: ["email-detail", forwardEmailId, "agent-approval"],
    queryFn: () => fetchEmailDetail(forwardEmailId!),
    enabled: forwardEmailId !== null,
    staleTime: 30_000,
  });

  const prefaceHtml =
    typeof args.body === "string" && args.body.trim().length > 0
      ? args.body.trim()
      : null;
  const resolvedSubject = isPresent(args.subject)
    ? String(args.subject)
    : forwardEmailQuery.data
      ? forwardEmailQuery.data.subject?.startsWith("Fwd:")
        ? forwardEmailQuery.data.subject
        : `Fwd: ${forwardEmailQuery.data.subject ?? ""}`.trim()
      : null;
  const resolvedBody = forwardEmailQuery.data
    ? prefaceHtml
      ? `${prefaceHtml}<p><br></p>${buildForwardedEmailPreviewHtml(
          forwardEmailQuery.data,
        )}`
      : buildForwardedEmailPreviewHtml(forwardEmailQuery.data)
    : prefaceHtml;

  return (
    <div className="space-y-3">
      {isPresent(args.to) && (
        <ToolField
          label="To"
          value={<p className="break-all">{String(args.to)}</p>}
        />
      )}
      {isPresent(args.cc) && (
        <ToolField
          label="CC"
          value={<p className="break-all">{String(args.cc)}</p>}
        />
      )}
      {resolvedSubject && (
        <ToolField
          label="Subject"
          value={<p className="text-balance">{resolvedSubject}</p>}
        />
      )}
      {resolvedBody && <ToolBodyPreview text={resolvedBody} />}
      {forwardEmailId && forwardEmailQuery.isPending && (
        <ToolField label="Forward" value="Loading forwarded email preview..." />
      )}
    </div>
  );
}

function ToolArgs({
  toolName,
  args,
}: {
  toolName: string;
  args: Record<string, unknown>;
}) {
  switch (toolName) {
    case "sendEmail":
    case "composeEmail":
      return <EmailActionArgs args={args} />;
    case "createTask": {
      return (
        <div className="space-y-3">
          {isPresent(args.title) && (
            <ToolField
              label="Title"
              value={<p className="text-balance">{String(args.title)}</p>}
            />
          )}
          {isPresent(args.dueAt) && (
            <ToolField
              label="Due"
              value={formatDueAt(args.dueAt) ?? String(args.dueAt)}
            />
          )}
        </div>
      );
    }
    case "updateTask": {
      return (
        <div className="space-y-3">
          {isPresent(args.taskId) && (
            <ToolField label="Task ID" value={String(args.taskId)} />
          )}
          {isPresent(args.title) && (
            <ToolField
              label="Title"
              value={<p className="text-balance">{String(args.title)}</p>}
            />
          )}
          {isPresent(args.status) && (
            <ToolField label="Status" value={String(args.status)} />
          )}
          {isPresent(args.priority) && (
            <ToolField label="Priority" value={String(args.priority)} />
          )}
          {args.dueAt !== undefined && (
            <ToolField
              label="Due"
              value={
                args.dueAt === null
                  ? "Clear due date"
                  : (formatDueAt(args.dueAt) ?? String(args.dueAt))
              }
            />
          )}
        </div>
      );
    }
    case "deleteTask":
    case "archiveEmail":
    case "trashEmail":
    case "snoozeEmail":
    case "unsubscribeEmail":
    case "markEmailRead":
    case "markEmailUnread":
    case "starEmail":
    case "unstarEmail":
    case "approveProposedEvent":
    case "dismissProposedEvent": {
      const fieldLabel = toolName.includes("Task")
        ? "Task ID"
        : toolName.includes("Proposed") || toolName.includes("Event")
          ? "Event ID"
          : "Email ID";
      const idValue =
        args.taskId ?? args.emailId ?? args.proposedId;

      return (
        <div className="space-y-3">
          {isPresent(idValue) && (
            <ToolField label={fieldLabel} value={String(idValue)} />
          )}
        </div>
      );
    }
    case "batchArchive":
    case "batchTrash": {
      const ids = Array.isArray(args.emailIds) ? args.emailIds : [];
      return (
        <div className="space-y-3">
          <ToolField
            label="Emails"
            value={`${ids.length} email${ids.length === 1 ? "" : "s"}`}
          />
        </div>
      );
    }
    default: {
      const entries = Object.entries(args).filter(([, value]) =>
        isPresent(value),
      );

      return (
        <div className="space-y-3">
          {entries.map(([key, value]) => (
            <ToolField
              key={key}
              label={key}
              multiline={typeof value === "string" && value.length > 120}
              value={
                typeof value === "string" && value.length > 120 ? (
                  <ToolBodyPreview text={value} />
                ) : (
                  formatGenericValue(value)
                )
              }
            />
          ))}
        </div>
      );
    }
  }
}

function buildKeyedMessageParts(messageId: string, parts: UIMessage["parts"]) {
  const normalizedParts: UIMessage["parts"] = [];

  for (const part of parts) {
    const previousPart = normalizedParts[normalizedParts.length - 1];
    if (
      previousPart &&
      getMessagePartSignature(previousPart) === getMessagePartSignature(part)
    ) {
      continue;
    }

    normalizedParts.push(part);
  }

  const counts = new Map<string, number>();

  return normalizedParts.map((part) => {
    const signature = getMessagePartSignature(part);
    const nextCount = counts.get(signature) ?? 0;
    counts.set(signature, nextCount + 1);
    return {
      key: `${messageId}-${signature}-${nextCount}`,
      part,
    };
  });
}

function getMessagePartSignature(part: UIMessage["parts"][number]) {
  if (part.type === "text") {
    return `text:${normalizeAgentText(part.text)}`;
  }

  if (isReasoningUIPart(part)) {
    return `reasoning:${part.text}`;
  }

  if (isToolUIPart(part)) {
    return `tool:${part.toolCallId}`;
  }

  return part.type;
}

function MessagePart({ part }: { part: UIMessage["parts"][number] }) {
  if (part.type === "text") {
    return (
      <div className="prose prose-xs max-w-none text-xs prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0 prose-headings:my-1.5 prose-headings:text-xs prose-hr:my-1.5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {normalizeAgentText(part.text)}
        </ReactMarkdown>
      </div>
    );
  }

  if (isReasoningUIPart(part)) {
    return <p className="text-xs text-muted-foreground">{part.text}</p>;
  }

  if (isToolUIPart(part)) {
    return null;
  }

  return null;
}

function InlineDiff({
  oldText,
  newText,
}: {
  oldText: string;
  newText: string;
}) {
  const parts = useMemo(() => diffWords(oldText, newText), [oldText, newText]);

  return (
    <div className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-background px-3 py-2 text-xs leading-relaxed">
      {parts.map((part, i) => {
        if (part.added) {
          return (
            <span
              key={i}
              className="bg-green-500/20 text-green-700 dark:text-green-400"
            >
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span
              key={i}
              className="bg-red-500/20 text-red-700 line-through dark:text-red-400"
            >
              {part.value}
            </span>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </div>
  );
}

function MessageActions({ text }: { text: string }) {
  const [showDiff, setShowDiff] = useState(false);
  const [applied, setApplied] = useState(false);
  const composerBody = showDiff ? getComposerBody() : null;
  const composerOpen = isComposerOpen();

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {composerOpen && !applied && (
          <Button
            size="xs"
            variant="ghost"
            className="h-6 text-[10px] text-muted-foreground"
            onClick={() => setShowDiff(true)}
          >
            <PencilSimpleIcon className="mr-1 size-3" />
            Apply to composer
          </Button>
        )}
        {applied && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <CheckIcon className="size-3" />
            Applied
          </span>
        )}
      </div>

      {showDiff && composerBody != null && (
        <div className="space-y-2">
          <InlineDiff oldText={composerBody} newText={text} />
          <div className="flex gap-1.5">
            <Button
              size="xs"
              variant="default"
              className="h-6 text-[10px]"
              onClick={() => {
                setComposerBody(text);
                setShowDiff(false);
                setApplied(true);
              }}
            >
              Confirm
            </Button>
            <Button
              size="xs"
              variant="ghost"
              className="h-6 text-[10px]"
              onClick={() => setShowDiff(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const keyedParts = buildKeyedMessageParts(message.id, message.parts);

  const lastTextPart = !isUser
    ? [...message.parts].reverse().find((p) => p.type === "text")
    : null;
  const lastText =
    lastTextPart?.type === "text"
      ? normalizeAgentText(lastTextPart.text)
      : null;

  return (
    <div
      className={`px-3 py-2 text-xs ${isUser ? "flex justify-end" : "font-mono"}`}
    >
      <div
        className={`space-y-2 ${
          isUser ? "max-w-[85%] rounded-md bg-muted/40 px-2 py-1" : "w-full"
        }`}
      >
        {keyedParts.map(({ key, part }) => (
          <MessagePart key={key} part={part} />
        ))}
        {lastText && <MessageActions text={lastText} />}
      </div>
    </div>
  );
}

export function ToolApprovalCard({
  toolCallId,
  toolName,
  args,
  onApprove,
  onDiscard,
}: {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const label = toolLabels[toolName] ?? humanizeToolName(toolName);

  return (
    <div className="mx-3 my-1.5 rounded-md bg-muted/50 p-3">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <div className="mt-2">
        <ToolArgs toolName={toolName} args={args} />
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant={"destructive"}
          onClick={() => {
            onDiscard(toolCallId);
          }}
        >
          Discard
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            onApprove(toolCallId);
          }}
        >
          Approve
        </Button>
      </div>
    </div>
  );
}

export function AgentThinking() {
  const synonyms = [
    "reflecting",
    "contemplating",
    "considering",
    "pondering",
    "reasoning",
    "deliberating",
    "analyzing",
    "meditating",
    "musing",
    "cogitating",
  ];

  const word = useMemo(() => {
    return synonyms[Math.floor(Math.random() * synonyms.length)];
  }, []);

  return (
    <span className="text-xs capitalize text-muted-foreground px-3">
      {word}...
    </span>
  );
}
