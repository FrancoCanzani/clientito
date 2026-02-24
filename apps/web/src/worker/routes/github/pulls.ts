import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { orgMembers, projects } from "../../db/schema";
import { account } from "../../db/auth-schema";
import type { AppRouteEnv } from "../types";
import { getPullsQuerySchema, pullRequestSchema } from "./schemas";

const errorResponseSchema = z.object({ error: z.string() });

const route = createRoute({
  method: "get",
  path: "/pulls",
  tags: ["github"],
  summary: "Fetch merged PRs from connected GitHub repo",
  request: { query: getPullsQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ data: z.array(pullRequestSchema) }) } },
      description: "Merged PRs",
    },
    401: { content: { "application/json": { schema: errorResponseSchema } }, description: "Unauthorized" },
    404: { content: { "application/json": { schema: errorResponseSchema } }, description: "Not found" },
  },
});

export function registerGetPulls(api: OpenAPIHono<AppRouteEnv>) {
  api.openapi(route, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { projectId } = c.req.valid("query");

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return c.json({ error: "Not found" }, 404);

    const membership = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, project.orgId), eq(orgMembers.userId, user.id)),
    });
    if (!membership) return c.json({ error: "Forbidden" }, 403 as any);

    if (!project.githubRepoOwner || !project.githubRepoName) {
      return c.json({ error: "No GitHub connection for this project" }, 404);
    }

    const githubAccount = await db
      .select()
      .from(account)
      .where(and(eq(account.userId, user.id), eq(account.providerId, "github")))
      .get();

    if (!githubAccount?.accessToken) {
      return c.json({ error: "No GitHub account linked. Sign in with GitHub first." }, 401);
    }

    const url = `https://api.github.com/repos/${project.githubRepoOwner}/${project.githubRepoName}/pulls?state=closed&sort=updated&direction=desc&per_page=30`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${githubAccount.accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "releaselayer",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      return c.json({ error: `GitHub API error: ${response.status} ${body}` }, 401 as any);
    }

    const pulls = (await response.json()) as any[];

    const merged = pulls
      .filter((pr) => pr.merged_at !== null)
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body ?? null,
        author: pr.user?.login ?? "unknown",
        htmlUrl: pr.html_url,
        mergedAt: pr.merged_at,
      }));

    return c.json({ data: merged }, 200);
  });
}
