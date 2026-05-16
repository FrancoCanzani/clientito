import type { Database } from "../../../db/client";
import type { mailboxes } from "../../../db/schema";
import { runTextFeature } from "../core/text";
import { GRAMMAR_CHECK_SYSTEM } from "./prompt";

export function runGrammarCheck(input: {
  env: Env;
  db: Database;
  userId: string;
  mailbox: typeof mailboxes.$inferSelect;
  text: string;
}) {
  return runTextFeature({
    ...input,
    feature: "grammar_check",
    system: GRAMMAR_CHECK_SYSTEM,
  });
}
