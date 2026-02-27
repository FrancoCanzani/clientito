import { format } from "date-fns";
import type { EmailListItem } from "./api";

export type EmailSection = {
  label: string;
  items: EmailListItem[];
};

export function formatInboxSectionDate(timestamp: number): string {
  return format(new Date(timestamp), "EEE, MMM d");
}

export function formatInboxRowDate(timestamp: number): string {
  return format(new Date(timestamp), "p");
}

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
