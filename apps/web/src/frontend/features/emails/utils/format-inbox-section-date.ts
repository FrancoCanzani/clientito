import { format, isToday, isYesterday } from "date-fns";

export function formatInboxSectionDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE, MMM d");
}
