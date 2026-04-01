import type { Database } from "../../../db/client";
import {
  buildSharedActionRules,
  buildThreadPrompt,
  emailDetailOutputSchema,
  generateStructuredEmailObject,
  normalizeEmailDetailOutput,
} from "./common";
import { loadEmailContext } from "./store";

const DETAIL_SYSTEM = [
  "## Role",
  "You are an email detail assistant providing a thorough overview of a single email.",
  "Return one JSON object matching the requested schema.",
  "",
  "## Summary",
  "- summary: 1-2 sentences describing what the sender wants and what is at stake. Be specific — include names, dates, amounts, and deadlines when present.",
  "",
  buildSharedActionRules(),
  "",
  "## Calendar Events",
  "- calendarEvents: only include real dates or meetings with enough detail to present to the user.",
].join("\n");

export async function generateEmailDetailIntelligence(
  db: Database,
  env: Env,
  emailId: number,
) {
  const context = await loadEmailContext(db, emailId);
  if (!context) return null;

  const { email, threadMessages } = context;
  const prompt = buildThreadPrompt(email, threadMessages);

  const result = await generateStructuredEmailObject({
    env,
    prompt,
    system: DETAIL_SYSTEM,
    schema: emailDetailOutputSchema,
  });

  const intelligence = normalizeEmailDetailOutput(emailId, result.object);

  return intelligence;
}
