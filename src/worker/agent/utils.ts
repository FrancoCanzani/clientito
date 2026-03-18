import type { UIMessageChunk } from "ai";
import { makeReadTools } from "./tools/read-tools";
import { makeWriteTools } from "./tools/write-tools";

const PSEUDO_TOOL_CALL_RE = /<tool_call>\s*([\s\S]+?)\s*<\/tool_call>/i;

const PSEUDO_TOOL_NAME_ALIASES: Record<string, string> = {
  archive: "archiveEmail",
  archiveEmail: "archiveEmail",
  createNote: "createNote",
  createTask: "createTask",
  draftReply: "draftReply",
  listTask: "listTasks",
  listTasks: "listTasks",
  lookupPerson: "lookupPerson",
  search: "searchEmails",
  searchEmail: "searchEmails",
  searchEmails: "searchEmails",
  summarize: "summarizeEmail",
  summarizeEmail: "summarizeEmail",
};

export type AgentTools = ReturnType<typeof makeReadTools> &
  ReturnType<typeof makeWriteTools>;

type PseudoToolCall = {
  raw: string;
  toolName: string;
  input: Record<string, unknown>;
};

export function safeSerialize(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function extractTextFromUIChunks(chunks: UIMessageChunk[]): string {
  return chunks
    .filter((chunk) => chunk.type === "text-delta")
    .map((chunk) => chunk.delta)
    .join("");
}

export function hasToolChunks(chunks: UIMessageChunk[]): boolean {
  return chunks.some((chunk) => chunk.type.startsWith("tool-"));
}

export function parsePseudoToolCall(text: string): PseudoToolCall | null {
  const match = text.match(PSEUDO_TOOL_CALL_RE);
  if (!match) return null;

  const raw = match[1]?.trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null")
    .replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*?)'/g, (_full, value: string) => `: ${JSON.stringify(value)}`);

  try {
    const parsed = JSON.parse(normalized) as {
      arguments?: Record<string, unknown>;
      name?: string;
    };

    if (
      !parsed ||
      typeof parsed.name !== "string" ||
      typeof parsed.arguments !== "object" ||
      parsed.arguments == null
    ) {
      return null;
    }

    return {
      raw,
      toolName: parsed.name,
      input: parsed.arguments,
    };
  } catch {
    return null;
  }
}

export function resolvePseudoToolName(toolName: string): string {
  return PSEUDO_TOOL_NAME_ALIASES[toolName] ?? toolName;
}

export async function parseToolInput(
  toolDefinition: AgentTools[keyof AgentTools],
  input: Record<string, unknown>,
): Promise<{ success: true; data: Record<string, unknown> } | { success: false; error: string }> {
  const schema = toolDefinition.inputSchema as {
    safeParseAsync?: (value: unknown) => Promise<{ success: boolean; data?: unknown; error?: { message?: string } }>;
    safeParse?: (value: unknown) => { success: boolean; data?: unknown; error?: { message?: string } };
  };

  if (typeof schema?.safeParseAsync === "function") {
    const result = await schema.safeParseAsync(input);
    if (result.success) {
      return { success: true, data: result.data as Record<string, unknown> };
    }

    return {
      success: false,
      error: result.error?.message ?? "Invalid tool input",
    };
  }

  if (typeof schema?.safeParse === "function") {
    const result = schema.safeParse(input);
    if (result.success) {
      return { success: true, data: result.data as Record<string, unknown> };
    }

    return {
      success: false,
      error: result.error?.message ?? "Invalid tool input",
    };
  }

  return { success: true, data: input };
}

export function formatPseudoToolSummary(toolName: string, output: unknown): string {
  if (toolName === "searchEmails" && typeof output === "object" && output) {
    const count = "count" in output && typeof output.count === "number" ? output.count : null;
    return count === 0
      ? "No matching emails found."
      : `Found ${count ?? "some"} matching emails.`;
  }

  if (toolName === "listTasks" && typeof output === "object" && output) {
    const count = "count" in output && typeof output.count === "number" ? output.count : null;
    return count === 0 ? "No matching tasks found." : `Found ${count ?? "some"} matching tasks.`;
  }

  if (toolName === "lookupPerson" && typeof output === "object" && output) {
    const count = "count" in output && typeof output.count === "number" ? output.count : null;
    return count === 0 ? "No matching records found." : `Found ${count ?? "some"} matching records.`;
  }

  if (toolName === "summarizeEmail" && typeof output === "object" && output) {
    if ("error" in output && typeof output.error === "string") {
      return output.error;
    }

    return "Fetched the email context.";
  }

  return `Executed ${toolName}. See the tool output below.`;
}

export function writeTextChunk(
  writer: { write: (chunk: UIMessageChunk) => void },
  text: string,
  id: string,
) {
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}
