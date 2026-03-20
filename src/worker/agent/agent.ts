import { AIChatAgent } from "@cloudflare/ai-chat";
import { createOpenAI } from "@ai-sdk/openai";
import type { OnChatMessageOptions } from "@cloudflare/ai-chat";
import type { Connection, ConnectionContext } from "agents";
import { getCurrentAgent } from "agents";
import type { StreamTextOnFinishCallback, ToolSet } from "ai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { auth } from "../../../auth";
import { createDb } from "../db/client";
import { AgentMemory } from "./memory";
import { makeMemoryTools } from "./tools/memory-tools";
import { makeReadTools } from "./tools/read-tools";
import { makeWriteTools } from "./tools/write-tools";
import { safeSerialize, type AgentTools } from "./utils";

const MODEL = "gpt-5.4";
const MAX_AGENT_STEPS = 6;

const BASE_SYSTEM_PROMPT = `You are a CRM command assistant. Answer in 1-2 short sentences.
Use tools to look up information or take actions. Be direct and factual.
Prefer doing over explaining. Never ask clarifying questions.
Use the exact runtime tool names when calling tools: searchEmails, searchEmailsByDate, listTasks, summarizeEmail, createTask, updateTask, deleteTask, createNote, archiveEmail, trashEmail, markEmailRead, markEmailUnread, starEmail, unstarEmail, sendEmail, draftReply, composeEmail, rememberThis, forgetThis, recallMemories.
After using tools, produce a final answer for the user. Do not end on a tool call unless you need approval for a write action.
If the user asks for a draft reply or asks you to write a reply to an email, call draftReply and then return only the reply body text. Do not add an intro, explanation, quotes, or labels.
draftReply is safe to use without approval because it only generates text and does not send or change anything.

You have persistent memory. When the user shares preferences, tells you about contacts, or asks you to remember something, use rememberThis to save it. Your memories are automatically included in the context so you can personalize responses. Use recallMemories if you need to check what you know.`;

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
  userEmail: string | null;
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
      userEmail: session?.user?.email ?? null,
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

    const connState =
      connection && typeof connection.state === "object" && connection.state
        ? (connection.state as AgentConnectionState)
        : null;

    const userId =
      session?.user.id ??
      (typeof options?.body?.userId === "string" ? options.body.userId : null) ??
      (this.name !== "anonymous" ? this.name : null) ??
      connState?.userId ?? null;

    const userEmail =
      session?.user.email ??
      connState?.userEmail ?? null;

    if (!userId) {
      console.warn("[Agent] Unauthorized chat request");
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
    const memory = new AgentMemory(this.ctx.storage);
    const tools: AgentTools = {
      ...makeReadTools(db, userId),
      ...makeWriteTools(db, userId, userEmail, this.env),
      ...makeMemoryTools(memory),
    };

    const systemPrompt = appendCurrentUrlPrompt(buildSystemPrompt(pageContext), currentUrl) + memory.formatForPrompt();

    const result = streamText({
      model: openai.responses(MODEL),
      system: systemPrompt,
      messages: await convertToModelMessages(this.messages),
      tools,
      stopWhen: stepCountIs(MAX_AGENT_STEPS),
      abortSignal: options?.abortSignal,
      onStepFinish: async (event) => {
        if (event.finishReason === "error") {
          console.error("[Agent] step error", {
            userId,
            step: event.stepNumber,
            text: event.text,
          });
        }
      },
      onFinish: async (event) => {
        if (event.finishReason === "error") {
          console.error("[Agent] finish error", {
            userId,
            reason: event.finishReason,
          });
        }
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: this.messages,
      sendFinish: true,
      onFinish,
    });
  }
}
