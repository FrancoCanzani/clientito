import type { EmailListPage } from "@/features/email/mail/types";
import type { InfiniteData } from "@tanstack/react-query";

function isEmailListPage(value: unknown): value is EmailListPage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { emails?: unknown };
  return Array.isArray(candidate.emails);
}

export function isEmailListInfiniteData(
  value: unknown,
): value is InfiniteData<EmailListPage> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { pages?: unknown };
  return Array.isArray(candidate.pages) && candidate.pages.every(isEmailListPage);
}
