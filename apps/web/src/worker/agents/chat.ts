import { AIChatAgent } from "@cloudflare/ai-chat";
import { convertToModelMessages, streamText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { createDb } from "../db/client";
import { getOrgAIContext } from "../lib/ai-context";
import { buildChatSystemPrompt } from "./system-prompt";

export class ChatAgent extends AIChatAgent<Env> {
  async onChatMessage(
    onFinish: Parameters<AIChatAgent<Env>["onChatMessage"]>[0],
    options?: Parameters<AIChatAgent<Env>["onChatMessage"]>[1],
  ) {
    const body = (options?.body ?? {}) as {
      orgId?: string;
      userId?: string;
      timezone?: string;
    };

    const orgId = body.orgId ?? "";
    let aiContext: string | null = null;

    if (orgId) {
      const db = createDb(this.env.DB);
      aiContext = await getOrgAIContext(db, orgId);
    }

    const system = buildChatSystemPrompt(orgId, aiContext);
    const workersAI = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: workersAI("@cf/meta/llama-4-scout-17b-16e-instruct"),
      system,
      messages: await convertToModelMessages(this.messages),
      onFinish,
    });

    return result.toUIMessageStreamResponse();
  }
}
