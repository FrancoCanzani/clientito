import { getGmailToken } from "../../lib/gmail/client";

export async function resolveGmailEmail(
  db: Parameters<typeof getGmailToken>[0],
  accountPk: string,
  env: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
): Promise<string | null> {
  try {
    const token = await getGmailToken(db, accountPk, env);
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const info = (await res.json()) as { email?: string };
    return info.email ?? null;
  } catch {
    return null;
  }
}
