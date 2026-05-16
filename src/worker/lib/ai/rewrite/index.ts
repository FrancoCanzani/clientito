import type { Database } from "../../../db/client";
import type { mailboxes } from "../../../db/schema";
import { runTextFeature } from "../core/text";
import { REWRITE_SYSTEM } from "./prompt";

export type RewriteInstruction = keyof typeof REWRITE_SYSTEM;

export function runRewrite(input: {
  env: Env;
  db: Database;
  userId: string;
  mailbox: typeof mailboxes.$inferSelect;
  text: string;
  instruction: RewriteInstruction;
}) {
  return runTextFeature({
    ...input,
    feature: `rewrite_${input.instruction}`,
    system: REWRITE_SYSTEM[input.instruction],
  });
}
