import type { EmailListItem } from "../types";
import { formatInboxSectionDate } from "./format-inbox-section-date";

export type EmailSection = {
  label: string;
  items: EmailListItem[];
};

export function groupEmailsByDay(emails: EmailListItem[]): EmailSection[] {
  const map = new Map<string, EmailListItem[]>();
  const order: string[] = [];

  for (const email of emails) {
    const key = formatInboxSectionDate(email.date);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(email);
  }

  return order.map((label) => ({
    label,
    items: map.get(label) ?? [],
  }));
}
