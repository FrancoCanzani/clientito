import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as authSchema from "./src/worker/db/auth-schema";
import { createResilientD1 } from "./src/worker/db/d1-resilient";

export function auth(env: Env) {
  const db = drizzle(createResilientD1(env.DB), {
    schema: authSchema,
    casing: "snake_case",
  });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        accessType: "offline",
        prompt: "consent",
        scope: [
          "openid",
          "email",
          "profile",
          "https://mail.google.com/",
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/gmail.settings.basic",
          "https://www.googleapis.com/auth/calendar.events",
        ],
      },
    },
    account: {
      accountLinking: {
        trustedProviders: ["google"],
        allowDifferentEmails: true,
      },
    },
    session: {
      cookieCache: {
        enabled: false,
        maxAge: 5 * 60,
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BETTER_AUTH_URL],
    advanced: {
      defaultCookieAttributes: {
        path: "/",
      },
    },
  });
}
