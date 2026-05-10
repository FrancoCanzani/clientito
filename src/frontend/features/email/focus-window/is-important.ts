import type { EmailListItem } from "@/features/email/mail/types";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";

const IMPORTANT_KEYWORDS = [
  "2fa",
  "account",
  "approval",
  "approve",
  "authentication",
  "billing",
  "card",
  "charge",
  "invoice",
  "login",
  "payment",
  "receipt",
  "security",
  "subscription",
  "verify",
];

export function isImportantEmail(email: EmailListItem): boolean {
  const labels = email.labelIds ?? [];
  if (labels.includes("TRASH") || labels.includes("SPAM")) return false;
  if (labels.includes("STARRED") || labels.includes("IMPORTANT")) return true;
  if (email.hasCalendar) return true;
  const text = `${email.subject ?? ""} ${email.snippet ?? ""}`.toLowerCase();
  if (IMPORTANT_KEYWORDS.some((term) => text.includes(term))) return true;
  return false;
}

export function isImportantThread(group: ThreadGroup): boolean {
  if (
    group.emails.every(
      (email) =>
        email.labelIds.includes("TRASH") || email.labelIds.includes("SPAM"),
    )
  ) {
    return false;
  }
  return group.emails.some(
    (email) => email.direction === "sent" || isImportantEmail(email),
  );
}