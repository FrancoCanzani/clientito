import { createWorkersAI } from "workers-ai-provider";

export const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export function getWorkersAIModel(env: Env) {
  const workersAI = createWorkersAI({ binding: env.AI });
  return workersAI(DEFAULT_WORKERS_AI_MODEL);
}

export function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
