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
  draftReply: "Draft reply",
  searchEmails: "Search emails",
  lookupPerson: "Look up person",
  lookupCompany: "Look up company",
  listTasks: "List tasks",
  summarizeEmail: "Summarize email",
};

function formatToolArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");
}

function formatUnknown(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AgentMessage({ message }: { message: UIMessage }) {
  return (
    <div className="space-y-2 px-3 py-1.5 text-sm text-foreground">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return <p key={`${message.id}-text-${i}`}>{part.text}</p>;
        }

        if (isReasoningUIPart(part)) {
          return (
            <div
              key={`${message.id}-reasoning-${i}`}
              className="rounded-md border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground"
            >
              {part.text}
            </div>
          );
        }

        if (isToolUIPart(part)) {
          const toolName = getToolName(part);
          const label = toolLabels[toolName] ?? toolName;

          if (part.state === "approval-requested") {
            return (
              <div
                key={`${message.id}-tool-${part.toolCallId}`}
                className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900"
              >
                <div className="font-medium">{label}</div>
                <div className="mt-1 text-amber-800">
                  Awaiting approval: {formatToolArgs(part.input as Record<string, unknown>)}
                </div>
              </div>
            );
          }

          if (part.state === "output-available") {
            return (
              <div
                key={`${message.id}-tool-${part.toolCallId}`}
                className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs"
              >
                <div className="font-medium text-foreground">{label}</div>
                <div className="mt-1 text-muted-foreground">
                  Input: {formatToolArgs(part.input as Record<string, unknown>)}
                </div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-foreground">
                  {formatUnknown(part.output)}
                </pre>
              </div>
            );
          }

          if (part.state === "output-error") {
            return (
              <div
                key={`${message.id}-tool-${part.toolCallId}`}
                className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs"
              >
                <div className="font-medium text-destructive">{label} failed</div>
                <div className="mt-1 text-muted-foreground">
                  Input: {formatToolArgs((part.input ?? {}) as Record<string, unknown>)}
                </div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-destructive">
                  {part.errorText}
                </pre>
              </div>
            );
          }

          if (part.state === "output-denied") {
            return (
              <div
                key={`${message.id}-tool-${part.toolCallId}`}
                className="rounded-md border border-border bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground"
              >
                {label} denied
              </div>
            );
          }

          return (
            <div
              key={`${message.id}-tool-${part.toolCallId}`}
              className="rounded-md border border-border bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground"
            >
              {label}: {part.state}
            </div>
          );
        }

        return null;
      })}
      {message.parts.length === 0 ? null : null}
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

export function AgentThinking() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5">
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
      <span className="text-xs text-muted-foreground">Thinking...</span>
    </div>
  );
}
