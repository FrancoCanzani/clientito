import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { sendGmailMessage } from "../../lib/gmail/send";
import type { AppRouteEnv } from "../types";
import { sendEmailBodySchema } from "./schemas";

export function registerPostEmail(api: Hono<AppRouteEnv>) {
  api.post("/send", zValidator("json", sendEmailBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const input = c.req.valid("json");

    try {
      const result = await sendGmailMessage(db, c.env, user.id, user.email, input);
      return c.json(
        { data: { gmailId: result.gmailId, threadId: result.threadId } },
        200,
      );
    } catch (error) {
      console.error("Failed to send email", { userId: user.id, error });
      return c.json(
        { error: error instanceof Error ? error.message : "Failed to send email" },
        500,
      );
    }
  });
}
