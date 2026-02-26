import { createWorkersAI } from "workers-ai-provider";

const CLASSIFIER_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export function parseAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

export function truncate(
  value: string | null | undefined,
  maxLength: number,
): string {
  if (!value) return "";
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

export function toNullableString(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getWorkersAIModel(env: Env) {
  const workersAI = createWorkersAI({ binding: env.AI });
  return workersAI(CLASSIFIER_MODEL, { safePrompt: false });
}

export async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}
