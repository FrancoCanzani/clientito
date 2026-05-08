import type { EmailListItem } from "@/features/email/mail/types";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";

const IMPORTANT_AI_CATEGORIES = new Set(["action_required", "invoice"]);
const MIN_AI_CONFIDENCE = 0.6;
const SECURITY_OR_PAYMENT_TERMS = [
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
 if (
 email.aiCategory &&
 IMPORTANT_AI_CATEGORIES.has(email.aiCategory) &&
 (email.aiConfidence == null || email.aiConfidence >= MIN_AI_CONFIDENCE)
 ) {
 return true;
 }
 if (
 email.aiCategory === "notification" &&
 (email.aiConfidence == null || email.aiConfidence >= MIN_AI_CONFIDENCE)
 ) {
 const text = `${email.subject ?? ""} ${email.snippet ?? ""}`.toLowerCase();
 return SECURITY_OR_PAYMENT_TERMS.some((term) => text.includes(term));
 }
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
