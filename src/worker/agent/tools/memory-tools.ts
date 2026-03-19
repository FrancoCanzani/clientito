import { tool } from "ai";
import { z } from "zod";
import type { AgentMemory, MemoryEntry } from "../memory";

export function makeMemoryTools(memory: AgentMemory) {
  return {
    rememberThis: tool({
      description:
        "Save a fact about the user to persistent memory. Use this when the user shares preferences, communication style, relationship context, or asks you to remember something. Categories: 'preference' (how they like things done), 'style' (writing/communication style), 'relationship' (info about their contacts), 'context' (general facts).",
      inputSchema: z.object({
        key: z
          .string()
          .describe("Short identifier for this memory, e.g. 'tone-preference' or 'ceo-name'."),
        content: z
          .string()
          .describe("The fact to remember."),
        category: z
          .enum(["preference", "context", "style", "relationship"])
          .default("context")
          .describe("Memory category."),
      }),
      execute: async ({ key, content, category }) => {
        memory.save(key, content, category as MemoryEntry["category"]);
        return { saved: true, key };
      },
    }),

    forgetThis: tool({
      description:
        "Remove a specific memory by its key. Use when the user asks you to forget something.",
      inputSchema: z.object({
        key: z
          .string()
          .describe("The key of the memory to remove."),
      }),
      needsApproval: true,
      execute: async ({ key }) => {
        memory.delete(key);
        return { deleted: true, key };
      },
    }),

    recallMemories: tool({
      description:
        "Retrieve all saved memories about the user. Use this to check what you know before making assumptions.",
      inputSchema: z.object({
        category: z
          .enum(["preference", "context", "style", "relationship"])
          .optional()
          .describe("Optional filter by category."),
      }),
      execute: async ({ category }) => {
        const entries = category
          ? memory.getByCategory(category as MemoryEntry["category"])
          : memory.getAll();
        return {
          memories: entries.map((e) => ({
            key: e.key,
            content: e.content,
            category: e.category,
          })),
          count: entries.length,
        };
      },
    }),
  };
}
