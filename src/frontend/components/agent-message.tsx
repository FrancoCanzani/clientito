import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import {
  getToolName,
  isReasoningUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import type { ReactNode } from "react";

const toolLabels: Record<string, string> = {
  createTask: "Create task",
  createNote: "Create note",
  archiveEmail: "Archive email",
  sendEmail: "Send email",
  composeEmail: "Compose email",
  searchEmails: "Search emails",
  resolveContact: "Look up contact",
  listTasks: "List tasks",
  summarizeEmail: "Summarize email",
};

function humanizeToolName(toolName: string): string {
  return toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

const toolActivityLabels: Record<
  string,
  {
    pending: string;
    complete: string;
    error: string;
    denied?: string;
  }
> = {
  createTask: {
    pending: "Preparing task",
    complete: "Prepared task",
    error: "Couldn't prepare task",
    denied: "Skipped task creation",
  },
  createNote: {
    pending: "Preparing note",
    complete: "Prepared note",
    error: "Couldn't prepare note",
    denied: "Skipped note creation",
  },
  archiveEmail: {
    pending: "Preparing archive action",
    complete: "Archived email",
    error: "Couldn't archive email",
    denied: "Skipped archive action",
  },
  composeEmail: {
    pending: "Preparing draft",
    complete: "Prepared draft",
    error: "Couldn't prepare draft",
    denied: "Skipped draft",
  },
  searchEmails: {
    pending: "Checking inbox",
    complete: "Checked inbox",
    error: "Couldn't check inbox",
  },
  resolveContact: {
    pending: "Looking up contact",
    complete: "Found contact",
    error: "Couldn't find contact",
  },
  listTasks: {
    pending: "Checking tasks",
    complete: "Checked tasks",
    error: "Couldn't check tasks",
  },
  summarizeEmail: {
    pending: "Reading email",
    complete: "Read email",
    error: "Couldn't read email",
  },
};

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
      <div className={multiline ? "text-xs text-foreground" : "min-w-0 text-xs text-foreground"}>
        {value}
      </div>
    </div>
  );
}

function ToolBodyPreview({ text }: { text: string }) {
  return (
    <div className="max-h-48 overflow-y-auto rounded-md border border-border/60 bg-background px-3 py-2">
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
        {text}
      </p>
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
    case "composeEmail": {
      const body =
        typeof args.body === "string" && args.body.trim().length > 0
          ? args.body.trim()
          : null;

      return (
        <div className="space-y-3">
          {isPresent(args.to) ? (
            <ToolField
              label="To"
              value={<p className="break-all">{String(args.to)}</p>}
            />
          ) : null}
          {isPresent(args.cc) ? (
            <ToolField
              label="CC"
              value={<p className="break-all">{String(args.cc)}</p>}
            />
          ) : null}
          {isPresent(args.subject) ? (
            <ToolField
              label="Subject"
              value={<p className="text-balance">{String(args.subject)}</p>}
            />
          ) : null}
          {body ? (
            <ToolField
              label="Body"
              multiline
              value={<ToolBodyPreview text={body} />}
            />
          ) : null}
        </div>
      );
    }
    case "createTask": {
      return (
        <div className="space-y-3">
          {isPresent(args.title) ? (
            <ToolField
              label="Title"
              value={<p className="text-balance">{String(args.title)}</p>}
            />
          ) : null}
          {isPresent(args.dueAt) ? (
            <ToolField
              label="Due"
              value={formatDueAt(args.dueAt) ?? String(args.dueAt)}
            />
          ) : null}
        </div>
      );
    }
    case "updateTask": {
      return (
        <div className="space-y-3">
          {isPresent(args.taskId) ? (
            <ToolField label="Task ID" value={String(args.taskId)} />
          ) : null}
          {isPresent(args.title) ? (
            <ToolField
              label="Title"
              value={<p className="text-balance">{String(args.title)}</p>}
            />
          ) : null}
          {isPresent(args.status) ? (
            <ToolField label="Status" value={String(args.status)} />
          ) : null}
          {isPresent(args.priority) ? (
            <ToolField label="Priority" value={String(args.priority)} />
          ) : null}
          {args.dueAt !== undefined ? (
            <ToolField
              label="Due"
              value={
                args.dueAt === null
                  ? "Clear due date"
                  : (formatDueAt(args.dueAt) ?? String(args.dueAt))
              }
            />
          ) : null}
        </div>
      );
    }
    case "deleteTask":
    case "archiveEmail":
    case "trashEmail":
    case "markEmailRead":
    case "markEmailUnread":
    case "starEmail":
    case "unstarEmail": {
      const fieldLabel = toolName.includes("Task") ? "Task ID" : "Email ID";
      const idValue = args.taskId ?? args.emailId;

      return (
        <div className="space-y-3">
          {isPresent(idValue) ? (
            <ToolField label={fieldLabel} value={String(idValue)} />
          ) : null}
        </div>
      );
    }
    case "createNote": {
      const content =
        typeof args.content === "string" && args.content.trim().length > 0
          ? args.content.trim()
          : null;

      return (
        <div className="space-y-3">
          {isPresent(args.title) ? (
            <ToolField
              label="Title"
              value={<p className="text-balance">{String(args.title)}</p>}
            />
          ) : null}
          {content ? (
            <ToolField
              label="Content"
              multiline
              value={<ToolBodyPreview text={content} />}
            />
          ) : null}
        </div>
      );
    }
    default: {
      const entries = Object.entries(args).filter(([, value]) => isPresent(value));

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
  const counts = new Map<string, number>();

  return parts.map((part) => {
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
    return `text:${part.text}`;
  }

  if (isReasoningUIPart(part)) {
    return `reasoning:${part.text}`;
  }

  if (isToolUIPart(part)) {
    return `tool:${part.toolCallId}`;
  }

  return part.type;
}

function MessagePart({
  part,
}: {
  part: UIMessage["parts"][number];
}) {
  if (part.type === "text") {
    return <p className="whitespace-pre-wrap">{part.text}</p>;
  }

  if (isReasoningUIPart(part)) {
    return <p className="text-xs text-muted-foreground">{part.text}</p>;
  }

  if (isToolUIPart(part)) {
    const toolName = getToolName(part);

    if (part.state === "approval-requested") {
      return null;
    }

    if (part.state === "output-error") {
      return (
        <ToolActivity
          tone="error"
          text={getToolActivityText(toolName, part.state)}
        />
      );
    }

    return <ToolActivity text={getToolActivityText(toolName, part.state)} />;
  }

  return null;
}

function getToolActivityText(toolName: string, state: string) {
  const labels = toolActivityLabels[toolName] ?? {
    pending: "Working",
    complete: "Done",
    error: "Something went wrong",
    denied: "Skipped",
  };

  if (state === "approval-requested") return labels.pending;
  if (state === "output-available") return labels.complete;
  if (state === "output-error") return labels.error;
  if (state === "output-denied") return labels.denied ?? "Skipped";
  return labels.pending;
}

function ToolActivity({
  tone = "muted",
  text,
}: {
  tone?: "muted" | "error";
  text: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-[10px] ${
        tone === "error" ? "text-destructive" : "text-muted-foreground/50"
      }`}
    >
      <span>{text}</span>
    </div>
  );
}

export function AgentMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const keyedParts = buildKeyedMessageParts(message.id, message.parts);

  return (
    <div className={`px-3 py-2 text-xs ${isUser ? "flex justify-end" : ""}`}>
      <div
        className={`space-y-2 ${
          isUser ? "max-w-[85%] rounded-md bg-muted/40 px-3 py-2" : "w-full"
        }`}
      >
        {keyedParts.map(({ key, part }) => (
          <MessagePart key={key} part={part} />
        ))}
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
          <XIcon className="mr-1 size-3" />
          Discard
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={() => {
            onApprove(toolCallId);
          }}
        >
          <CheckIcon className="mr-1 size-3" />
          Approve
        </Button>
      </div>
    </div>
  );
}

export function AgentThinking({ label = "Thinking..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5">
      <span className="text-[10px] animate-pulse text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
