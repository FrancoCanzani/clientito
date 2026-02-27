import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  format,
  isValid,
} from "date-fns";

export function formatRelativeTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  if (!isValid(date)) return "";

  const now = new Date();
  const minutes = differenceInMinutes(now, date);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours}h ago`;

  const days = differenceInDays(now, date);
  if (days < 30) return `${days}d ago`;

  return format(date, "P");
}
