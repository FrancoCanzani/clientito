import { z } from "zod";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const GOOGLE_CONNECT_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

const googleTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
});

const googleUserInfoSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  verified_email: z.literal(true),
});

export type GoogleToken = z.infer<typeof googleTokenSchema>;
export type GoogleUserInfo = z.infer<typeof googleUserInfoSchema>;

type GoogleOAuthEnv = Pick<
  Env,
  "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "BETTER_AUTH_URL"
>;

function callbackURL(env: Pick<Env, "BETTER_AUTH_URL">) {
  return `${env.BETTER_AUTH_URL}/api/auth/callback/google`;
}

export function buildGoogleConnectURL({
  env,
  state,
  codeChallenge,
}: {
  env: Pick<Env, "GOOGLE_CLIENT_ID" | "BETTER_AUTH_URL">;
  state: string;
  codeChallenge: string;
}) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", callbackURL(env));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CONNECT_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function exchangeGoogleCode({
  env,
  code,
  codeVerifier,
}: {
  env: GoogleOAuthEnv;
  code: string;
  codeVerifier: string;
}): Promise<GoogleToken> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: callbackURL(env),
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status}`);
  }
  return googleTokenSchema.parse(await response.json());
}

export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Google userinfo failed: ${response.status}`);
  }
  return googleUserInfoSchema.parse(await response.json());
}

export function randomBase64URL(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toBase64URL(bytes);
}

export async function sha256Base64URL(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return toBase64URL(new Uint8Array(digest));
}

function toBase64URL(bytes: Uint8Array) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
