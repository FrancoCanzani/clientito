import type { MailboxAccount } from "@/hooks/use-mailboxes";
import { z } from "zod";

const ACTIVE_MAILBOX_STORAGE_KEY = "petit.activeMailboxId";
const mailboxIdSchema = z.coerce.number().int().positive();

function parseStrictMailboxId(value: string): number | undefined {
  const result = mailboxIdSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function getStoredMailboxId(): number | null {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(ACTIVE_MAILBOX_STORAGE_KEY);
  if (!stored) return null;

  return parseStrictMailboxId(stored) ?? null;
}

export function getPreferredMailboxId<
  T extends Pick<MailboxAccount, "mailboxId">,
>(accounts: readonly T[]) {
  const storedMailboxId = getStoredMailboxId();
  if (
    storedMailboxId != null &&
    accounts.some((account) => account.mailboxId === storedMailboxId)
  ) {
    return storedMailboxId;
  }

  return (
    accounts.find((account) => account.mailboxId != null)?.mailboxId ?? null
  );
}
