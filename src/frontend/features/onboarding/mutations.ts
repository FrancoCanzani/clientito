import { authClient } from "@/lib/auth-client";

export const GMAIL_SCOPES = [
 "https://www.googleapis.com/auth/gmail.readonly",
 "https://www.googleapis.com/auth/gmail.modify",
 "https://www.googleapis.com/auth/gmail.send",
 "https://www.googleapis.com/auth/gmail.settings.basic",
];

export async function beginGmailConnection(callbackURL = "/settings") {
 const result = await authClient.linkSocial({
 provider: "google",
 callbackURL,
 scopes: GMAIL_SCOPES,
 });

 if (result?.error) {
 throw new Error(result.error.message || "Google connection failed.");
 }
}
