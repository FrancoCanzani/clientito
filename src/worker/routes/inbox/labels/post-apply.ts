import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { GmailDriver } from "../../../lib/gmail/driver";
import type { AppRouteEnv } from "../../types";

const applyLabelSchema = z.object({
  mailboxId: z.number().int().positive(),
  providerMessageIds: z.array(z.string().min(1)).min(1),
  labelId: z.string().min(1),
});

export function registerApplyLabel(api: Hono<AppRouteEnv>) {
  api.post("/apply", zValidator("json", applyLabelSchema), async (c) => {
    const db = c.get("db");
    const env = c.env;
    const { mailboxId, providerMessageIds, labelId } = c.req.valid("json");

    const driver = new GmailDriver(db, env, mailboxId);
    await driver.modifyLabels(providerMessageIds, [labelId], []);

    return c.json({ success: true }, 200);
  });
}
