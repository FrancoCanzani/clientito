import { and, desc, eq, ne } from "drizzle-orm";
import type { Hono } from "hono";
import { emailSubscriptions } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";

export function registerGetSuggestions(api: Hono<AppRouteEnv>) {
  api.get("/suggestions", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const activeSubscriptions = await db
      .select({
        fromAddr: emailSubscriptions.fromAddr,
        fromName: emailSubscriptions.fromName,
        emailCount: emailSubscriptions.emailCount,
        lastReceivedAt: emailSubscriptions.lastReceivedAt,
        unsubscribeUrl: emailSubscriptions.unsubscribeUrl,
        unsubscribeEmail: emailSubscriptions.unsubscribeEmail,
      })
      .from(emailSubscriptions)
      .where(
        and(
          eq(emailSubscriptions.userId, user.id),
          ne(emailSubscriptions.status, "unsubscribed"),
        ),
      )
      .orderBy(desc(emailSubscriptions.emailCount));

    const topSenders = activeSubscriptions.slice(0, 10).map((s) => ({
      fromAddr: s.fromAddr,
      fromName: s.fromName,
      emailCount: s.emailCount,
      lastReceived: s.lastReceivedAt,
      unsubscribeUrl: s.unsubscribeUrl,
      unsubscribeEmail: s.unsubscribeEmail,
    }));

    const domainMap = new Map<
      string,
      {
        totalEmailCount: number;
        senders: {
          fromAddr: string;
          fromName: string | null;
          emailCount: number;
          unsubscribeUrl: string | null;
          unsubscribeEmail: string | null;
        }[];
      }
    >();

    for (const s of activeSubscriptions) {
      const domain = s.fromAddr.split("@")[1] ?? s.fromAddr;
      const group = domainMap.get(domain) ?? {
        totalEmailCount: 0,
        senders: [],
      };
      group.totalEmailCount += s.emailCount;
      group.senders.push({
        fromAddr: s.fromAddr,
        fromName: s.fromName,
        emailCount: s.emailCount,
        unsubscribeUrl: s.unsubscribeUrl,
        unsubscribeEmail: s.unsubscribeEmail,
      });
      domainMap.set(domain, group);
    }

    const domainGroups = Array.from(domainMap.entries())
      .map(([domain, group]) => ({
        domain,
        totalEmailCount: group.totalEmailCount,
        senderCount: group.senders.length,
        senders: group.senders.sort((a, b) => b.emailCount - a.emailCount),
      }))
      .sort((a, b) => b.totalEmailCount - a.totalEmailCount)
      .slice(0, 5);

    return c.json({ topSenders, domainGroups });
  });
}
