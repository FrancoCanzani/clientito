import type { Context } from "hono";

export async function getHealth(c: Context) {
  return c.json({ ok: true });
}
