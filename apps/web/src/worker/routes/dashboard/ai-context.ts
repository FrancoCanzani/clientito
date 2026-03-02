export function buildSystemPrompt(
  basePrompt: string,
  aiContext: string | null,
): string {
  if (!aiContext) return basePrompt;
  return `${basePrompt}\n\nUser context: ${aiContext}`;
}
