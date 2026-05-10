import { localDb } from "@/db/client";

export function gatekeeperActivatedAtKey(mailboxId: number): string {
  return `gatekeeperActivatedAt:${mailboxId}`;
}

export async function resolveGatekeeperActivatedAt(
  mailboxId: number,
): Promise<number> {
  const key = gatekeeperActivatedAtKey(mailboxId);
  const raw = await localDb.getMeta(key);
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

  const now = Date.now();
  await localDb.setMeta(key, String(now));
  return now;
}