# Soul of the Project

## Core Idea

An email client where the AI is not a feature -- it is the interface.

The command bar at the bottom of every page is the primary way users interact with the app. It handles navigation, actions, and natural language. When the user types something that is not a command, it goes to an AI agent that can read their emails, create tasks, draft replies, and take actions on their behalf -- with explicit approval before anything mutates.

The rest of the app (inbox, people, companies, notes, tasks) is a simple, fast read layer. The agent is the write layer.

## What Makes This Different

Most email apps bolt AI onto existing UI (a summarize button, a draft button). Here the agent IS the UI. One input, one place to talk to the system, and it does things. People and companies exist as passive context the agent uses, not as features users manage. The command bar is always visible, always reachable, and gets smarter over time as more tools are added.

## Architecture

```
                         Command Palette (bottom bar)
                                   |
                    +--------------+--------------+
                    |                             |
              Matches a command?             Natural language
              (navigation, theme,           (goes to agent)
               compose, new task)                 |
                    |                             |
              Execute immediately          WebSocket to EmailAgent
                                                  |
                                    +-------------+-------------+
                                    |                           |
                              Auto tools                  Approval tools
                           (search, lookup,              (create task, send
                            summarize)                    email, draft reply)
                                    |                           |
                              Results stream             Action card appears
                              into palette               in palette with
                                                         Approve / Discard
```

### Backend: Cloudflare Agent (Durable Object)

One `EmailAgent` instance per user. It is a `AIChatAgent` from `@cloudflare/ai-chat` running on a Durable Object with embedded SQLite. It has persistent conversation history, tool definitions, and direct access to the D1 database.

The agent coexists with the existing Hono API server. Hono handles REST routes (emails list, people CRUD, etc). The agent handles AI interactions over WebSocket.

```typescript
// src/worker/index.ts (simplified)
import { routeAgentRequest } from "agents";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Agent WebSocket requests go to the Durable Object
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    // Everything else goes to Hono (REST API + static assets)
    return app.fetch(request, env, ctx);
  },
};

// The agent class is exported from the same worker
export { EmailAgent } from "./agent/email-agent";
```

### Frontend: Command Palette as Agent Interface

The existing command palette (`command-palette.tsx`) gains a second mode:

1. **Command mode** (current) -- fuzzy match navigation and actions
2. **Agent mode** -- when input does not match any command, or when explicitly triggered, the palette connects to the agent via WebSocket

Agent responses render in the same expandable area where the command list currently appears. Tool calls that need approval render as inline cards with Approve/Discard buttons. After approval, a toast confirms and the palette closes.

### Mobile

The palette is already a bottom bar. On mobile it works like a chat input -- tap to focus, type naturally. No Cmd+K needed. Optionally add a small floating action button that opens it on mobile.

## Agent Tools

Each tool is defined using the Vercel AI SDK `tool()` function with Zod schemas. Tools fall into two categories:

### Auto-execute (no approval needed)

These gather information. The agent calls them freely and uses the results to answer or propose actions.

| Tool | What it does | Data source |
|------|-------------|-------------|
| `searchEmails` | Search emails by keyword, sender, date range | D1 emails table |
| `lookupContact` | Get person info, company, recent emails | D1 people + companies + emails |
| `summarizeThread` | Read a thread and return a summary | D1 emails table + Workers AI |
| `getTasksDue` | List tasks due today or overdue | D1 tasks table |

### Approval-required (user confirms before execution)

These mutate data or have side effects. The agent proposes, the user decides.

| Tool | What it does | Side effect |
|------|-------------|-------------|
| `createTask` | Create a task with title and optional due date | INSERT into tasks |
| `createNote` | Create a note | INSERT into notes |
| `draftReply` | Generate a reply to an email thread | Shows draft in UI, user can edit before sending |
| `sendEmail` | Send an email via Gmail API | Gmail API send |
| `markEmailRead` | Mark email(s) as read | Gmail API modify + D1 update |

The `needsApproval` function on each tool returns `true` to trigger the approval UI:

```typescript
createTask: tool({
  description: "Create a task for the user",
  inputSchema: z.object({
    title: z.string().describe("Task title"),
    dueAt: z.string().optional().describe("Due date in ISO format"),
    personId: z.number().optional().describe("Link to a person"),
  }),
  needsApproval: async () => true, // always ask
  execute: async ({ title, dueAt, personId }) => {
    await db.insert(tasks).values({
      userId,
      title,
      dueAt: dueAt ? new Date(dueAt).getTime() : null,
      personId: personId ?? null,
      done: false,
      createdAt: Date.now(),
    });
    return { created: true, title };
  },
}),
```

## Approval UI

When a tool needs approval, the `AIChatAgent` sends a message part with `state: "approval-required"`. The frontend renders it as a card:

```
+-----------------------------------------------+
|  Create task                                   |
|  "Follow up with Maria about the proposal"     |
|  Due: Friday, March 13                         |
|                                                |
|  [ Discard ]                     [ Create ]    |
+-----------------------------------------------+
```

The card shows:
- Tool name as a header
- The proposed parameters in human-readable form
- Discard (reject) and Approve buttons

On approve: the tool executes, a toast confirms, palette closes.
On discard: the tool is rejected, the agent acknowledges and moves on.

The implementation uses `useAgentChat` from `@cloudflare/ai-chat/react`:

```typescript
const { messages, sendMessage, addToolApprovalResponse } = useAgentChat({
  agent,
  onToolCall: async ({ toolCall, addToolOutput }) => {
    // Handle client-side tools if any
  },
});

// In the render, for approval-required parts:
addToolApprovalResponse({ id: toolCallId, approved: true });  // or false
```

## Folder Structure

New files marked with `+`. Modified files marked with `~`.

```
src/
  worker/
    agent/
+     email-agent.ts          # AIChatAgent class, tool definitions, system prompt
+     tools/
+       search-emails.ts      # searchEmails tool
+       lookup-contact.ts     # lookupContact tool
+       summarize-thread.ts   # summarizeThread tool
+       create-task.ts        # createTask tool (approval)
+       create-note.ts        # createNote tool (approval)
+       draft-reply.ts        # draftReply tool (approval)
+       send-email.ts         # sendEmail tool (approval)
+       get-tasks-due.ts      # getTasksDue tool
~   index.ts                  # Add routeAgentRequest + export EmailAgent
    db/
~     schema.ts               # No changes needed (schema already has everything)
    routes/
      ai/                     # Existing AI routes -- keep working, migrate later
        ...
  frontend/
    features/
+     agent/
+       hooks/
+         use-email-agent.ts  # useAgent + useAgentChat wrapper
+       components/
+         agent-response.tsx   # Renders agent text, tool results, approval cards
+         tool-approval-card.tsx  # Single approval card component
~   components/
~     command-palette.tsx      # Add agent mode alongside command mode
```

## Dependencies to Install

```
@cloudflare/ai-chat agents workers-ai-provider
```

Already installed: `ai`, `zod`, `workers-ai-provider`

## Wrangler Configuration

```jsonc
// Add to wrangler.json:
{
  "durable_objects": {
    "bindings": [
      { "name": "EmailAgent", "class_name": "EmailAgent" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["EmailAgent"] }
  ]
}
```

The agent uses its own embedded SQLite (for conversation history and agent state) separate from the D1 database (which holds emails, tasks, etc). The agent accesses D1 via `this.env.DB`.

## System Prompt

The agent needs a system prompt that:

1. Knows it is an email assistant
2. Knows what tools are available and when to use them
3. Defaults to proposing actions rather than just answering
4. Keeps responses short -- this is a command bar, not a chat window
5. Uses context from the current page (which email is open, which person is being viewed) when provided

```
You are an email assistant. You help the user manage their inbox by taking actions.

When the user asks something, prefer to DO something rather than just explain.
- "remind me to follow up" -> use createTask
- "what did Maria say" -> use searchEmails, then summarize
- "reply saying I'll be there" -> use draftReply

Keep responses to 1-2 sentences. This is a command bar, not a chat.
When proposing an action, be specific about what you will do.
```

## Implementation Phases

### Phase 1: Agent Backend

Get the Durable Object running with tools. Test via curl or a simple WebSocket client.

Files: `email-agent.ts`, all tool files, `index.ts` changes, `wrangler.json` changes.

Milestone: Can send a WebSocket message like "create a task to follow up with Maria tomorrow" and get back an approval request, then approve it and see the task in D1.

### Phase 2: Command Palette Integration

Wire the palette to the agent. When no command matches, switch to agent mode.

Files: `use-email-agent.ts`, `agent-response.tsx`, `tool-approval-card.tsx`, `command-palette.tsx` changes.

Milestone: Open the app, Cmd+K, type "what emails did I get today", see results inline. Type "remind me to reply to the Acme thread", see approval card, click approve, task created.

### Phase 3: Context Awareness

When viewing an email, automatically pass thread context to the agent so it can make relevant suggestions without the user having to explain what they are looking at.

Files: Modify `email-detail-content.tsx` to pass current email/thread ID to the agent hook. Modify `email-agent.ts` to accept context.

Milestone: Open an email, open the command bar, type "summarize this" and the agent knows which thread you mean.

### Phase 4: Deprecate Old AI Routes

Once the agent handles summarization, draft replies, person context, and briefings via tools, remove the standalone `/api/ai/*` endpoints and their frontend callers.

Files to remove:
- `src/worker/routes/ai/post-summarize-email.ts`
- `src/worker/routes/ai/post-draft-reply.ts`
- `src/worker/routes/ai/get-person-context.ts`
- `src/worker/routes/ai/get-briefing.ts`
- `src/frontend/features/dashboard/components/dashboard-briefing-stream.tsx`

## What We Are NOT Building

- A chatbot with long conversations. The command bar is for quick actions. 1-2 exchanges max.
- A dashboard with AI widgets. The agent replaces the need for dashboards.
- Enrichment or data scraping. We use what we have from email sync.
- Calendar integration. Out of scope for now.
- Autonomous background agents. Everything requires user initiation or approval.

## Database

No schema changes needed. The agent reads and writes to the existing D1 tables:

- `emails` -- search, read threads
- `people` -- lookup contacts
- `companies` -- lookup company context
- `tasks` -- create tasks
- `notes` -- create notes

The agent's own conversation history is stored in the Durable Object's embedded SQLite (handled automatically by `AIChatAgent`).

## Open Questions

1. **Rate limiting** -- Workers AI has per-account limits. Need to think about throttling heavy users.
2. **Model choice** -- Currently using `llama-3.3-70b-instruct-fp8-fast`. May want to test smaller models for tool routing and larger for generation.
3. **Streaming** -- The command bar UI needs to handle streaming text. Keep it simple: show a typing indicator, then the full response. No character-by-character streaming in a small bar.
4. **Error handling** -- When a tool fails (Gmail API down, DB error), the agent should say so plainly and not retry in a loop.
5. **Mobile trigger** -- How does the user open the command bar on mobile? Options: always-visible bottom bar (current), floating button, swipe gesture. Decide during Phase 2.
