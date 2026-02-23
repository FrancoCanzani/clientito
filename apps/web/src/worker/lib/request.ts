import type { Context } from "hono";
import { badRequest } from "./errors";

export async function parseJsonBody<T>(c: Context): Promise<T> {
  try {
    return await c.req.json<T>();
  } catch {
    throw badRequest("Invalid JSON body");
  }
}
