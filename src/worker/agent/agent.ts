import { AIChatAgent } from "@cloudflare/ai-chat";
import { createOpenAI } from "@ai-sdk/openai";
import type { OnChatMessageOptions } from "@cloudflare/ai-chat";
import type { Connection, ConnectionContext } from "agents";
import { getCurrentAgent } from "agents";
import type { StreamTextOnFinishCallback, ToolSet, UIMessageChunk } from "ai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import { auth } from "../../../auth";
import { createDb } from "../db/client";
import { makeReadTools } from "./tools/read-tools";
import { makeWriteTools } from "./tools/write-tools";
import {
  extractTextFromUIChunks,
  formatPseudoToolSummary,
  hasToolChunks,
  parsePseudoToolCall,
  parseToolInput,
  resolvePseudoToolName,
  safeSerialize,
  type AgentTools,
  writeTextChunk,
} from "./utils";

const MODEL = "gpt-5.4";
const MAX_AGENT_STEPS = 6;

const BASE_SYSTEM_PROMPT = `You are a CRM command assistant. Answer in 1-2 short sentences.
Use tools to look up information or take actions. Be direct and factual.
Prefer doing over explaining. Never ask clarifying questions.
Use the exact runtime tool names when calling tools: searchEmails, lookupPerson, listTasks, summarizeEmail, createTask, createNote, archiveEmail, draftReply.
After using tools, produce a final answer for the user. Do not end on a tool call unless you need approval for a write action.
If the user asks for a draft reply or asks you to write a reply to an email, call draftReply and then return only the reply body text. Do not add an intro, explanation, quotes, or labels.
draftReply is safe to use without approval because it only generates text and does not send or change anything.
Never emit XML, JSON, or <tool_call> tags in plain text.`;

type EntityContext =
  | { type: "email"; id: string; subject: string | null; fromName: string | null; fromAddr: string; threadId: string | null }
  | { type: "person"; id: string; name: string | null; email: string | null }
  | { type: "note"; id: string; title: string | null }
  | { type: "task"; id: string; title: string };

type PageContext = {
  route?: string;
  entity?: EntityContext;
};

function describeEntity(entity: EntityContext): string {
  switch (entity.type) {
    case "email": {
      const lines = [`From: ${entity.fromName ?? entity.fromAddr}`];
      if (entity.subject) lines.push(`Subject: ${entity.subject}`);
      lines.push(`Email ID: ${entity.id}`);
      if (entity.threadId) lines.push(`Thread ID: ${entity.threadId}`);
      return `an email:\n${lines.join("\n")}`;
    }
    case "person": {
      const lines = [`Name: ${entity.name ?? "Unknown"}`];
      if (entity.email) lines.push(`Email: ${entity.email}`);
      lines.push(`Person ID: ${entity.id}`);
      return `a person:\n${lines.join("\n")}`;
    }
    case "note":
      return `a note:\nTitle: ${entity.title ?? "Untitled"}\nNote ID: ${entity.id}`;
    case "task":
      return `a task:\nTitle: ${entity.title}\nTask ID: ${entity.id}`;
  }
}

function buildSystemPrompt(pageContext?: PageContext): string {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(now);

  let prompt = `${BASE_SYSTEM_PROMPT}\n\nCurrent time: ${time}`;

  if (pageContext?.route) {
    prompt += `\nThe user is on the ${pageContext.route} page.`;
  }

  if (pageContext?.entity) {
    prompt += `\nThey are currently viewing ${describeEntity(pageContext.entity)}`;
    prompt += `\nWhen they say "this", "it", "here", etc., they mean the entity above. Use its ID directly with the relevant tools.`;
  }

  return prompt;
}

function appendCurrentUrlPrompt(prompt: string, currentUrl?: string): string {
  if (!currentUrl) return prompt;

  return `${prompt}
Current URL: ${currentUrl}
Inspect the current URL when the user refers to "this", "current", "here", or a page they are viewing.
If the URL contains a relevant entity ID such as an email ID, note ID, person ID, or thread ID, use that ID in the appropriate tool call before answering.
Do not claim page-specific context unless it is supported by the current URL or by tool results.`;
}

type AgentConnectionState = {
  userId: string | null;
};

export class Agent extends AIChatAgent<Env> {
  async onConnect(connection: Connection, ctx: ConnectionContext) {
    await super.onConnect(connection, ctx);

    const session = await auth(this.env).api.getSession({
      headers: ctx.request.headers,
    });

    const currentState =
      typeof connection.state === "object" && connection.state
        ? (connection.state as Record<string, unknown>)
        : {};

    connection.setState({
      ...currentState,
      userId: session?.user?.id ?? null,
    } satisfies AgentConnectionState & Record<string, unknown>);
  }

  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: OnChatMessageOptions,
  ) {
    const { connection, request } = getCurrentAgent<Agent>();

    const session = request
      ? await auth(this.env).api.getSession({
          headers: request.headers,
        })
      : null;

    const userId =
      session?.user.id ??
      (typeof options?.body?.userId === "string" ? options.body.userId : null) ??
      (this.name !== "anonymous" ? this.name : null) ??
      (connection &&
      typeof connection.state === "object" &&
      connection.state &&
      "userId" in connection.state
        ? (connection.state.userId as string | null)
        : null);

    if (!userId) {
      console.warn("[Agent] Unauthorized chat request", {
        agentName: this.name,
        hasRequest: Boolean(request),
        hasConnection: Boolean(connection),
        bodyUserId:
          typeof options?.body?.userId === "string" ? options.body.userId : null,
        connectionState:
          connection && typeof connection.state === "object"
            ? safeSerialize(connection.state)
            : null,
      });
      return new Response("Unauthorized", { status: 401 });
    }

    const pageContext =
      options?.body && typeof options.body === "object" && "pageContext" in options.body
        ? (options.body.pageContext as PageContext | undefined)
        : undefined;
    const currentUrl =
      options?.body &&
      typeof options.body === "object" &&
      typeof options.body.currentUrl === "string"
        ? options.body.currentUrl
        : undefined;

    const db = createDb(this.env.DB);
    const openai = createOpenAI({
      apiKey: this.env.OPENAI_API_KEY,
    });
    const tools: AgentTools = {
      ...makeReadTools(db, userId),
      ...makeWriteTools(db, userId, this.env),
    };

    const result = streamText({
      model: openai.responses(MODEL),
      system: appendCurrentUrlPrompt(buildSystemPrompt(pageContext), currentUrl),
      messages: await convertToModelMessages(this.messages),
      tools,
      stopWhen: stepCountIs(MAX_AGENT_STEPS),
      abortSignal: options?.abortSignal,
      experimental_onToolCallStart: async (event) => {
        console.log("[Agent] tool start", {
          agentName: this.name,
          userId,
          stepNumber: event.stepNumber,
          toolName: event.toolCall.toolName,
          toolCallId: event.toolCall.toolCallId,
          input: safeSerialize(event.toolCall.input),
        });
      },
      experimental_onToolCallFinish: async (event) => {
        console.log("[Agent] tool finish", {
          agentName: this.name,
          userId,
          stepNumber: event.stepNumber,
          toolName: event.toolCall.toolName,
          toolCallId: event.toolCall.toolCallId,
          success: event.success,
          durationMs: event.durationMs,
          output: event.success ? safeSerialize(event.output) : null,
          error: event.success ? null : safeSerialize(event.error),
        });
      },
      onStepFinish: async (event) => {
        console.log("[Agent] step finish", {
          agentName: this.name,
          userId,
          stepNumber: event.stepNumber,
          finishReason: event.finishReason,
          text: event.text,
          toolCalls: safeSerialize(event.toolCalls),
          toolResults: safeSerialize(event.toolResults),
        });
      },
      onFinish: async (event) => {
        console.log("[Agent] finish", {
          agentName: this.name,
          userId,
          finishReason: event.finishReason,
          text: event.text,
          steps: event.steps.length,
          toolCalls: safeSerialize(event.toolCalls),
          toolResults: safeSerialize(event.toolResults),
        });
        await onFinish(event as never);
      },
    });

    const uiStream = result.toUIMessageStream({
      originalMessages: this.messages,
    });

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        originalMessages: this.messages,
        onFinish: async (event) => {
          await onFinish(event as never);
        },
        execute: async ({ writer }) => {
          const chunks: UIMessageChunk[] = [];
          for await (const chunk of uiStream) {
            chunks.push(chunk);
          }

          const text = extractTextFromUIChunks(chunks).trim();
          const pseudoToolCall = !hasToolChunks(chunks) ? parsePseudoToolCall(text) : null;

          if (!pseudoToolCall) {
            for (const chunk of chunks) {
              writer.write(chunk);
            }
            return;
          }

          const requestedToolName = pseudoToolCall.toolName;
          const resolvedToolName = resolvePseudoToolName(requestedToolName);
          const toolDefinition = tools[resolvedToolName as keyof AgentTools];
          const toolCallId = `pseudo-${Date.now()}-${resolvedToolName}`;
          const textId = `${toolCallId}-text`;
          const startChunk = chunks.find((chunk) => chunk.type === "start");

          console.warn("[Agent] pseudo tool call fallback", {
            agentName: this.name,
            userId,
            requestedToolName,
            resolvedToolName,
            input: safeSerialize(pseudoToolCall.input),
            raw: pseudoToolCall.raw,
          });

          writer.write(startChunk ?? { type: "start" });
          writer.write({ type: "start-step" });

          if (!toolDefinition) {
            writer.write({
              type: "tool-input-available",
              toolCallId,
              toolName: resolvedToolName,
              input: pseudoToolCall.input,
            });
            writer.write({
              type: "tool-output-error",
              toolCallId,
              errorText: `Unknown tool "${requestedToolName}"`,
            });
            writeTextChunk(
              writer,
              `The model requested an unknown tool (${requestedToolName}).`,
              textId,
            );
            writer.write({ type: "finish-step" });
            writer.write({ type: "finish", finishReason: "error" });
            return;
          }

          const parsedInput = await parseToolInput(toolDefinition, pseudoToolCall.input);

          writer.write({
            type: "tool-input-available",
            toolCallId,
            toolName: resolvedToolName,
            input: parsedInput.success ? parsedInput.data : pseudoToolCall.input,
          });

          if (!parsedInput.success) {
            writer.write({
              type: "tool-output-error",
              toolCallId,
              errorText: parsedInput.error,
            });
            writeTextChunk(
              writer,
              `The model produced invalid arguments for ${resolvedToolName}.`,
              textId,
            );
            writer.write({ type: "finish-step" });
            writer.write({ type: "finish", finishReason: "error" });
            return;
          }

          const executableTool = toolDefinition as AgentTools[keyof AgentTools] & {
            execute?: (input: Record<string, unknown>, options: { toolCallId: string; messages: Awaited<ReturnType<typeof convertToModelMessages>> }) => Promise<unknown> | unknown;
            needsApproval?: boolean | ((input: Record<string, unknown>, options: { toolCallId: string; messages: Awaited<ReturnType<typeof convertToModelMessages>> }) => Promise<boolean> | boolean);
          };

          const modelMessages = await convertToModelMessages(this.messages);
          const needsApproval =
            typeof executableTool.needsApproval === "function"
              ? await executableTool.needsApproval(parsedInput.data, {
                  toolCallId,
                  messages: modelMessages,
                })
              : Boolean(executableTool.needsApproval);

          if (needsApproval) {
            writer.write({
              type: "tool-output-error",
              toolCallId,
              errorText:
                "The model emitted a pseudo tool call for a write action. Fallback execution is disabled for approval-required tools.",
            });
            writeTextChunk(
              writer,
              `The tool call for ${resolvedToolName} needs approval, so fallback execution was skipped.`,
              textId,
            );
            writer.write({ type: "finish-step" });
            writer.write({ type: "finish", finishReason: "stop" });
            return;
          }

          try {
            console.log("[Agent] pseudo tool start", {
              agentName: this.name,
              userId,
              toolName: resolvedToolName,
              toolCallId,
              input: safeSerialize(parsedInput.data),
            });

            const output = await executableTool.execute?.(parsedInput.data, {
              toolCallId,
              messages: modelMessages,
            });

            const debugOutput = {
              debug: {
                rawToolCall: pseudoToolCall.raw,
                requestedToolName,
                resolvedToolName,
              },
              result: output,
            };

            console.log("[Agent] pseudo tool finish", {
              agentName: this.name,
              userId,
              toolName: resolvedToolName,
              toolCallId,
              output: safeSerialize(debugOutput),
            });

            writer.write({
              type: "tool-output-available",
              toolCallId,
              output: debugOutput,
            });
            writeTextChunk(
              writer,
              `${formatPseudoToolSummary(resolvedToolName, output)} Fallback execution was used because the model returned plain-text tool markup.`,
              textId,
            );
            writer.write({ type: "finish-step" });
            writer.write({ type: "finish", finishReason: "stop" });
          } catch (error) {
            console.error("[Agent] pseudo tool error", {
              agentName: this.name,
              userId,
              toolName: resolvedToolName,
              toolCallId,
              error: safeSerialize(error),
            });

            writer.write({
              type: "tool-output-error",
              toolCallId,
              errorText: error instanceof Error ? error.message : "Tool execution failed",
            });
            writeTextChunk(
              writer,
              `Fallback execution for ${resolvedToolName} failed.`,
              textId,
            );
            writer.write({ type: "finish-step" });
            writer.write({ type: "finish", finishReason: "error" });
          }
        },
      }),
    });
  }
}
