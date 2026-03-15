import { format } from "date-fns";

export function formatInboxRowDate(timestamp: number): string {
  return format(new Date(timestamp), "p");
}
