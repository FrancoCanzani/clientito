import type { Database } from "../../../db/client";
import {
  buildThreadPrompt,
  emailDetailOutputSchema,
  generateStructuredEmailObject,
  normalizeEmailDetailOutput,
} from "./common";
import { loadEmailContext } from "./store";

const DETAIL_SYSTEM = [
  "You are an email detail assistant.",
  "Return one JSON object matching the requested schema.",
  "summary must be 1-2 sentences describing what the sender wants and what is at stake.",
  "actions must contain only meaningful actions, with at most 4 items.",
  "Every action object must include payload with keys draft, labelName, and until.",
  "For unused payload fields, return null.",
  "Only use action types reply, archive, label, or snooze.",
  "Do not suggest reply actions for automated notifications, newsletters, promos, or social network recommendation emails unless a human response is explicitly expected.",
  "Do not copy URLs, tracking links, or long CTA links into reply drafts.",
  "Keep reply drafts short and plain text.",
  "Use trustLevel=approve for replies and any external commitment.",
  "Use trustLevel=auto only for clearly safe local actions like archive or snooze.",
  "For reply actions, include payload.draft with the full reply body text.",
  "For snooze actions, include payload.until as an ISO date or datetime.",
  "For label actions, include payload.labelName.",
  "calendarEvents must include only real dates or meetings with enough detail to present to a user.",
].join(" ");

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
