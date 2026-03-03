import { and, eq } from "drizzle-orm";
import { account, user } from "../../db/auth-schema";
import type { Database } from "../../db/client";
import {
  GOOGLE_RECONNECT_REQUIRED_MESSAGE,
  isGmailReconnectRequiredError,
} from "./errors";
import type { GoogleOAuthConfig, GoogleTokenResponse } from "./types";

export const TOKEN_REFRESH_BUFFER_MS = 60_000;
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function toEpochMs(
  value: Date | number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveGoogleCredentials(config?: GoogleOAuthConfig) {
  const clientId = config?.GOOGLE_CLIENT_ID;
  const clientSecret = config?.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured.");
  }

  return { clientId, clientSecret };
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
  config?: GoogleOAuthConfig,
) {
  const { clientId, clientSecret } = resolveGoogleCredentials(config);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    if (payload.error === "invalid_grant") {
      throw new Error(GOOGLE_RECONNECT_REQUIRED_MESSAGE);
    }

    const message =
      payload.error_description ??
      payload.error ??
      `Google token refresh failed (${response.status}).`;
    throw new Error(message);
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in ?? 3600,
    scope: payload.scope,
  };
}

export async function clearGoogleConnectionTokens(
  db: Database,
  userId: string,
): Promise<void> {
  await db
    .update(account)
    .set({
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    })
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")));
}

export async function getGmailToken(
  db: Database,
  userId: string,
  config?: GoogleOAuthConfig,
): Promise<string> {
  const googleAccount = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "google")),
  });

  if (!googleAccount) {
    throw new Error("Google account is not connected.");
  }

  const expiresAt = toEpochMs(googleAccount.accessTokenExpiresAt);
  const now = Date.now();
  const hasValidAccessToken =
    Boolean(googleAccount.accessToken) &&
    (expiresAt === null || expiresAt - TOKEN_REFRESH_BUFFER_MS > now);

  if (hasValidAccessToken) {
    return googleAccount.accessToken!;
  }

  if (!googleAccount.refreshToken) {
    await clearGoogleConnectionTokens(db, userId);
    throw new Error(GOOGLE_RECONNECT_REQUIRED_MESSAGE);
  }

  let refreshed: Awaited<ReturnType<typeof refreshGoogleAccessToken>>;
  try {
    refreshed = await refreshGoogleAccessToken(
      googleAccount.refreshToken,
      config,
    );
  } catch (error) {
    if (isGmailReconnectRequiredError(error)) {
      await clearGoogleConnectionTokens(db, userId);
    }
    throw error;
  }
  const nextExpiresAt =
    refreshed.expiresIn > 0
      ? new Date(Date.now() + refreshed.expiresIn * 1000)
      : null;

  await db
    .update(account)
    .set({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? googleAccount.refreshToken,
      accessTokenExpiresAt: nextExpiresAt,
      scope: refreshed.scope ?? googleAccount.scope,
    })
    .where(eq(account.id, googleAccount.id));

  return refreshed.accessToken;
}

export async function syncGoogleUserProfile(
  db: Database,
  userId: string,
  accessToken: string,
): Promise<void> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    return;
  }

  const payload = (await response
    .json()
    .catch(() => ({}))) as { name?: string; picture?: string };
  const nextName = payload.name?.trim();
  const nextImage = payload.picture?.trim();

  if (!nextName && !nextImage) {
    return;
  }

  const updates: Partial<typeof user.$inferInsert> = {};
  if (nextName) updates.name = nextName;
  if (nextImage) updates.image = nextImage;

  if (Object.keys(updates).length === 0) {
    return;
  }

  await db.update(user).set(updates).where(eq(user.id, userId));
}
