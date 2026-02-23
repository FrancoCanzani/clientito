import type { Context } from "hono";

export async function getHealth(c: Context<{ Bindings: Env }>) {
  return c.json({ ok: true });
}
