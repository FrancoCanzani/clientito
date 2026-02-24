import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { orgMembers, projects, releases, releaseItems } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const errorResponseSchema = z.object({ error: z.string() });

const route = createRoute({
  method: "post",
  path: "/:releaseId/generate-notes",
  tags: ["releases"],
  summary: "Generate AI release notes",
  request: {
    params: z.object({ releaseId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.object({ notes: z.string() }) }),
        },
      },
      description: "Generated notes",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

export function registerGenerateNotes(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(route, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { releaseId } = c.req.valid("param");

    const release = await db.query.releases.findFirst({
      where: eq(releases.id, releaseId),
    });
    if (!release) return c.json({ error: "Not found" }, 404);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, release.projectId),
    });
    if (!project) return c.json({ error: "Not found" }, 404);

    const membership = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, project.orgId), eq(orgMembers.userId, user.id)),
    });
    if (!membership) return c.json({ error: "Forbidden" }, 403 as any);

    const items = await db
      .select()
      .from(releaseItems)
      .where(eq(releaseItems.releaseId, releaseId))
      .orderBy(asc(releaseItems.sortOrder));

    if (items.length === 0) {
      return c.json({ data: { notes: "No items to summarize." } }, 200);
    }

    const itemList = items
      .map((item, i) => {
        let line = `${i + 1}. ${item.title}`;
        if (item.description) line += ` — ${item.description}`;
        if (item.kind === "pr" && item.prNumber) line += ` (PR #${item.prNumber})`;
        return line;
      })
      .join("\n");

    const prompt = `You are a technical writer. Write concise, user-friendly release notes in markdown format for the following changes. Group related items if appropriate. Use bullet points. Do not include a title heading — just the notes body.\n\nRelease: ${release.title}${release.version ? ` v${release.version}` : ""}\n\nChanges:\n${itemList}`;

    const env = c.env as Env;
    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as any, {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    });

    const notes = (result as any).response || "";

    return c.json({ data: { notes } }, 200);
  });
}
