import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import {
  getToolName,
  isReasoningUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";

const toolLabels: Record<string, string> = {
  createTask: "Create task",
  createNote: "Create note",
  archiveEmail: "Archive email",
  composeEmail: "Compose email",
  draftReply: "Draft reply",
  searchEmails: "Search emails",
  lookupPerson: "Look up person",
  listTasks: "List tasks",
  summarizeEmail: "Summarize email",
};

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
  draftReply: {
    pending: "Drafting reply",
    complete: "Drafted reply",
    error: "Couldn't draft reply",
    denied: "Skipped reply draft",
  },
  searchEmails: {
    pending: "Checking inbox",
    complete: "Checked inbox",
    error: "Couldn't check inbox",
  },
  lookupPerson: {
    pending: "Looking up contact",
    complete: "Checked contact",
    error: "Couldn't check contact",
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

function formatToolArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");
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
      className={`flex items-center gap-2 text-xs ${
        tone === "error" ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      <span
        className={`size-1 rounded-full ${
          tone === "error" ? "bg-destructive" : "bg-muted-foreground/80"
        }`}
      />
      <span>{text}</span>
    </div>
  );
}

export function AgentMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`px-3 py-2 text-sm text-foreground ${
        isUser ? "flex justify-end" : ""
      }`}
    >
      <div
        className={`space-y-2 ${
          isUser ? "max-w-[85%] rounded-xl border border-border bg-muted/40 px-3 py-2" : "w-full"
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <p key={`${message.id}-text-${i}`} className="whitespace-pre-wrap">
                {part.text}
              </p>
            );
          }

          if (isReasoningUIPart(part)) {
            return (
              <p
                key={`${message.id}-reasoning-${i}`}
                className="text-xs text-muted-foreground"
              >
                {part.text}
              </p>
            );
          }

          if (isToolUIPart(part)) {
            const toolName = getToolName(part);

            if (part.state === "approval-requested") {
              return null;
            }

            if (part.state === "output-available") {
              return (
                <ToolActivity
                  key={`${message.id}-tool-${part.toolCallId}`}
                  text={getToolActivityText(toolName, part.state)}
                />
              );
            }

            if (part.state === "output-error") {
              return (
                <ToolActivity
                  key={`${message.id}-tool-${part.toolCallId}`}
                  tone="error"
                  text={getToolActivityText(toolName, part.state)}
                />
              );
            }

            if (part.state === "output-denied") {
              return (
                <ToolActivity
                  key={`${message.id}-tool-${part.toolCallId}`}
                  text={getToolActivityText(toolName, part.state)}
                />
              );
            }

            return (
              <ToolActivity
                key={`${message.id}-tool-${part.toolCallId}`}
                text={getToolActivityText(toolName, part.state)}
              />
            );
          }

          return null;
        })}
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
  const label = toolLabels[toolName] ?? toolName;

  return (
    <div className="mx-3 my-1.5 rounded-lg border border-border bg-muted/50 p-3">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatToolArgs(args)}
      </p>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs"
          onClick={() => {
            onApprove(toolCallId);
          }}
        >
          <CheckIcon className="mr-1 size-3" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => {
            onDiscard(toolCallId);
          }}
        >
          <XIcon className="mr-1 size-3" />
          Discard
        </Button>
      </div>
    </div>
  );
}

export function AgentThinking({ label = "Thinking..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5">
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
