import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { mailboxes } from "../../db/schema";
import { GmailDriver } from "./providers/google/driver";
import type { EmailProvider } from "./types";

export async function createEmailProvider(
  db: Database,
  env: Env,
  mailboxId: number,
): Promise<EmailProvider> {
  const mailbox = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.id, mailboxId),
    columns: { provider: true },
  });

  const provider = mailbox?.provider ?? "google";

  switch (provider) {
    case "google":
      return new GmailDriver(db, env, mailboxId);
    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }
}
