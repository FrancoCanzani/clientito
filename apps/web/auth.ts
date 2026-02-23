import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as authSchema from "./src/worker/db/auth-schema";
import { eq } from "drizzle-orm";
import { createDb } from "./src/worker/db/client";
import { users } from "./src/worker/db/schema";
import { ensureDefaultOrganization } from "./src/worker/auth/user";

export function createAuth(env: Env) {
  const db = drizzle(env.DB, { schema: authSchema, casing: "snake_case" });
  const appDb = createDb(env.DB);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BETTER_AUTH_URL],
    advanced: {
      defaultCookieAttributes: {
        path: "/",
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const existing = await appDb.query.users.findFirst({
              where: eq(users.id, user.id),
            });
            if (existing) return;

            await appDb.insert(users).values({
              id: user.id,
              email: user.email,
              name: user.name ?? null,
            });

            await ensureDefaultOrganization(appDb, {
              id: user.id,
              email: user.email,
              name: user.name,
            });
          },
        },
      },
    },
  });
}
