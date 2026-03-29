import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseMailboxId(id: string): number | undefined {
  if (id === "all") return undefined;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function getActiveInboxId(pathname: string): string {
  const match = pathname.match(/^\/inbox\/([^/]+)/);
  return match?.[1] ?? "all";
}

export function getSearchMailboxId(pathname: string): number | undefined {
  const match = pathname.match(/^\/inbox\/([^/]+)/);
  return match ? parseMailboxId(match[1]) : undefined;
}
