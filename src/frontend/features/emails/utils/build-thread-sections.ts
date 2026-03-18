import { formatInboxSectionDate } from "./format-inbox-section-date";
import type { ThreadGroup } from "./group-emails-by-thread";

export type ThreadSection = {
  label: string;
  items: ThreadGroup[];
};

export function buildThreadSections(groups: ThreadGroup[]): ThreadSection[] {
  const map = new Map<string, ThreadGroup[]>();
  const order: string[] = [];

  for (const group of groups) {
    const key = formatInboxSectionDate(group.representative.date);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(group);
  }

  return order.map((label) => ({
    label,
    items: map.get(label) ?? [],
  }));
}
