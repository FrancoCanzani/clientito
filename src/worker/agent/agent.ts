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

const MODEL = "gpt-5.4";
const MAX_AGENT_STEPS = 10;

const BASE_SYSTEM_PROMPT = `You are an app assistant embedded in the user's workspace.
You can help with email, tasks, notes, and app navigation.
Use tools to look up information or take actions. Be action-oriented, direct, and factual.
Prefer doing over explaining, and complete the user's intent whenever the available tools allow it.
Use the exact runtime tool names when calling tools: searchEmails, searchEmailsByDate, getEmail, getBriefing, listTasks, summarizeEmail, resolveContact, createTask, updateTask, deleteTask, createNote, updateNote, deleteNote, archiveEmail, batchArchive, trashEmail, batchTrash, snoozeEmail, unsubscribeEmail, approveProposedEvent, dismissProposedEvent, markEmailRead, markEmailUnread, markAllEmailsRead, starEmail, unstarEmail, sendEmail, composeEmail, rememberThis, forgetThis, recallMemories.
When the user asks to improve, fix, rewrite, or shorten text in their compose draft, just output the improved version directly in chat. The UI will offer a button to apply it to the composer with a visual diff.
After using tools, produce a final answer for the user. Do not end on a tool call unless you need approval for a write action.
Never ask the user to type "approve", "confirm", or similar in plain chat for a write action. If you have enough information to perform a write action, call the write tool directly and let the app's approval UI handle approval.
Use multiple tools when needed to finish the task.
If one search returns nothing, broaden the search before giving up.
Make reasonable assumptions when the user's intent is clear.
Ask a clarifying question only when a missing detail would materially change the outcome.
When blocked, say exactly why in one sentence and propose the next best action.
Be concise, but not unnaturally brief.
Always respond in the same language the user writes their message in, regardless of the language of any emails or content being discussed.
When the user says things like "send it", "go ahead", "do it", "open it", or "draft it", treat that as permission to execute the relevant action with the latest agreed content instead of restating the draft.
When the user asks for wording changes, casing changes, or rewrites, update the latest draft directly. Do not explain obvious edits or repeat the same suggestions unless the user asks for alternatives.
Do not repeat the same answer in consecutive turns.
If a tool result, approval, or continuation resumes an in-progress answer, do not restate text you already showed earlier in that same answer. Only add the new information needed to finish it.
If you already drafted a reply in the current answer, do not print the same draft again.
If the user asks for help writing a reply, drafting a reply, or improving reply wording, write the reply directly in chat unless they explicitly ask you to open a draft in the app, reply in the UI, or send it.
When the entity context includes a body preview or draft reply, use that information directly instead of calling summarizeEmail or getEmail — you already have the content.
Use getEmail when you need to read a specific email's full content by ID. Use summarizeEmail only when the user explicitly asks for an AI summary.
For batch operations like "archive all newsletters" or "trash all marketing emails", use batchArchive or batchTrash with multiple IDs instead of calling archiveEmail/trashEmail repeatedly.
When the user asks to snooze an email, use snoozeEmail. When they ask to unsubscribe, use unsubscribeEmail.
For proposed calendar events, use approveProposedEvent or dismissProposedEvent.
If the user asks to reply to an email in the app, open a compose window with a pre-filled reply using composeEmail.
If the user asks to forward an email to someone, use sendEmail with forwardEmailId so the forwarded message content is included automatically and can be approved before sending. Use composeEmail only when they explicitly want a draft or compose window.
If the user asks to "mark all as read", use markAllEmailsRead instead of calling markEmailRead repeatedly.
If the user asks for a briefing, inbox overview, or a summary of what needs attention, gather the relevant emails and tasks and synthesize the briefing yourself. You may use getBriefing when it is the fastest way to produce a good result, but it is not required.
If the user asks to find emails, first search using the exact address, phrase, or name they gave. If nothing is found, try a broader search using name fragments or domain fragments before concluding there are no results.
If a search still returns nothing, explain that nothing was found in the synced app inbox and that older email may exist outside the local sync window.
For task requests, create, update, complete, or review tasks directly when the intent is clear.
For notes, create or update notes directly when the intent is clear.
If the user has already provided the recipient, subject, and body for an email in the current conversation, reuse that information when they later ask you to send it unless they changed one of those fields.
When the user refers to a person by name (e.g. "email Pedro", "send to Sarah"), ALWAYS use resolveContact first to find their email address. If multiple matches are returned, present the list and ask the user to pick. Never guess an email address.
The user may have multiple Gmail accounts connected. Email searches return results from all accounts. If a mailbox ID is available in the current context, use it for composeEmail/sendEmail. If sending account selection is ambiguous, tell the user they need to choose the sender account.

You have persistent memory. When the user shares preferences, tells you about contacts, or asks you to remember something, use rememberThis to save it. Your memories are automatically included in the context so you can personalize responses. Use recallMemories if you need to check what you know.`;

type EntityContext =
  | { type: "email"; id: string; subject: string | null; fromName: string | null; fromAddr: string; threadId: string | null; mailboxId: number | null; bodyPreview?: string | null; draftReply?: string | null }
  | { type: "person"; id: string; name: string | null; email: string | null }
  | { type: "note"; id: string; title: string | null }
  | { type: "task"; id: string; title: string };

type PageContext = {
  route?: string;
  entity?: EntityContext;
  composer?: { body: string } | null;
};

type AuthConnectionState = {
  userId: string;
  userEmail: string | null;
};

function describeEntity(entity: EntityContext): string {
  switch (entity.type) {
    case "email": {
      const lines = [`From: ${entity.fromName ?? entity.fromAddr}`];
      if (entity.subject) lines.push(`Subject: ${entity.subject}`);
      lines.push(`Email ID: ${entity.id}`);
      if (entity.threadId) lines.push(`Thread ID: ${entity.threadId}`);
      if (entity.mailboxId) lines.push(`Mailbox ID: ${entity.mailboxId}`);
      if (entity.bodyPreview) lines.push(`Body preview:\n${entity.bodyPreview}`);
      if (entity.draftReply) lines.push(`Existing draft reply:\n${entity.draftReply}`);
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

  if (pageContext?.composer?.body) {
    prompt += `\n\nThe user has a compose window open with this draft:\n${pageContext.composer.body}`;
    prompt += `\nWhen they ask to improve, fix, rewrite, or edit the draft, just write the improved version directly in your response. The UI will let them apply it to the composer.`;
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

export class Agent extends AIChatAgent<Env> {
  async onConnect(connection: Connection, ctx: ConnectionContext) {
    const session = await auth(this.env).api.getSession({
      headers: ctx.request.headers,
    });

    if (!session?.user.id) {
      console.warn("[Agent] Unauthorized connection attempt");
      connection.setState(null);
      return;
    }

    connection.setState({
      userId: session.user.id,
      userEmail: session.user.email ?? null,
    } satisfies AuthConnectionState);
  }

  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: OnChatMessageOptions,
  ) {
    const { connection, request } = getCurrentAgent<Agent>();
    const connectionAuth = (connection?.state ?? null) as AuthConnectionState | null;

    let userId = connectionAuth?.userId ?? null;
    let userEmail = connectionAuth?.userEmail ?? null;

    if (!userId && request) {
      const session = await auth(this.env).api.getSession({
        headers: request.headers,
      });

      userId = session?.user.id ?? null;
      userEmail = session?.user.email ?? null;

      if (userId && connection) {
        connection.setState({
          userId,
          userEmail,
        } satisfies AuthConnectionState);
      }
    }

    if (!userId) {
      console.warn("[Agent] Unauthorized chat request", {
        hasConnection: Boolean(connection),
        hasRequest: Boolean(request),
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
    const memory = new AgentMemory(this.ctx.storage);
    const tools: ToolSet = {
      ...makeReadTools(db, userId, this.env, currentUrl),
      ...makeWriteTools(db, userId, userEmail, this.env, currentUrl, pageContext),
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

        await onFinish(event);
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: this.messages,
      sendFinish: true,
    });
  }
}
