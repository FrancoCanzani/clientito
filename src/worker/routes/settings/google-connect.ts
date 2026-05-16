import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Context, Hono } from "hono";
import { z } from "zod";
import { verification } from "../../db/auth-schema";
import { connectGoogleAccount } from "../../lib/accounts/rehome-google-account";
import {
  buildGoogleConnectURL,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  randomBase64URL,
  sha256Base64URL,
} from "../../lib/google/oauth";
import { getUser } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";

const CONNECT_STATE_PREFIX = "gmail-connect:";
const CONNECT_STATE_TTL_MS = 10 * 60 * 1000;

const connectRequestSchema = z.object({
  callbackURL: z.string().optional(),
  errorCallbackURL: z.string().optional(),
});

const connectStateSchema = z.object({
  userId: z.string().min(1),
  callbackURL: z.string().min(1),
  errorCallbackURL: z.string().min(1),
  codeVerifier: z.string().min(1),
});

type ConnectState = z.infer<typeof connectStateSchema>;

export function registerGoogleConnect(api: Hono<AppRouteEnv>) {
  api.post(
    "/accounts/google/connect",
    zValidator("json", connectRequestSchema),
    async (c) => {
      const user = getUser(c);
      const body = c.req.valid("json");
      const callbackURL = normalizeRelativeURL(body.callbackURL, "/settings");
      const errorCallbackURL = normalizeRelativeURL(
        body.errorCallbackURL,
        withError(callbackURL, "connect_failed"),
      );

      const stateId = crypto.randomUUID();
      const codeVerifier = randomBase64URL(64);
      const codeChallenge = await sha256Base64URL(codeVerifier);
      await storeConnectState(c, stateId, {
        userId: user.id,
        callbackURL,
        errorCallbackURL,
        codeVerifier,
      });

      const url = buildGoogleConnectURL({
        env: c.env,
        state: stateId,
        codeChallenge,
      });
      return c.json({ data: { url: url.toString() } });
    },
  );
}

export async function handleGoogleConnectCallback(
  c: Context<AppRouteEnv>,
): Promise<Response | null> {
  const stateId = c.req.query("state");
  if (!stateId) return null;

  const storedState = await findConnectState(c, stateId);
  if (!storedState) return null;
  if (storedState.expiresAt.getTime() < Date.now()) {
    return c.redirect("/settings?connect_error=1&error=expired_state");
  }

  await c.get("db").delete(verification).where(eq(verification.id, storedState.id));

  const state = parseConnectState(storedState.value);
  if (!state) {
    return c.redirect("/settings?connect_error=1&error=invalid_state");
  }

  const oauthError = c.req.query("error");
  const code = c.req.query("code");
  if (oauthError || !code) {
    return c.redirect(withError(state.errorCallbackURL, oauthError ?? "no_code"));
  }

  try {
    const tokens = await exchangeGoogleCode({
      env: c.env,
      code,
      codeVerifier: state.codeVerifier,
    });
    const userInfo = await fetchGoogleUserInfo(tokens.access_token);
    await connectGoogleAccount({
      db: c.get("db"),
      currentUserId: state.userId,
      providerAccountId: userInfo.id,
      tokens,
    });
    return c.redirect(withConnected(state.callbackURL));
  } catch (error) {
    console.error("Failed to connect Google account", error);
    return c.redirect(withError(state.errorCallbackURL, "unable_to_link_account"));
  }
}

async function storeConnectState(
  c: Context<AppRouteEnv>,
  stateId: string,
  state: ConnectState,
) {
  const now = new Date();
  await c.get("db").insert(verification).values({
    id: crypto.randomUUID(),
    identifier: `${CONNECT_STATE_PREFIX}${stateId}`,
    value: JSON.stringify(state),
    expiresAt: new Date(now.getTime() + CONNECT_STATE_TTL_MS),
    createdAt: now,
    updatedAt: now,
  });
}

async function findConnectState(c: Context<AppRouteEnv>, stateId: string) {
  return c.get("db").query.verification.findFirst({
    where: eq(verification.identifier, `${CONNECT_STATE_PREFIX}${stateId}`),
  });
}

function parseConnectState(value: string): ConnectState | null {
  const parsed = connectStateSchema.safeParse(parseJSON(value));
  return parsed.success ? parsed.data : null;
}

function parseJSON(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeRelativeURL(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function withConnected(callbackURL: string) {
  return appendQueryParam(callbackURL, "connected", "1");
}

function withError(callbackURL: string, error: string) {
  return appendQueryParam(
    appendQueryParam(callbackURL, "connect_error", "1"),
    "error",
    error,
  );
}

function appendQueryParam(url: string, key: string, value: string) {
  const next = new URL(url, "https://local.invalid");
  next.searchParams.set(key, value);
  return `${next.pathname}${next.search}`;
}
