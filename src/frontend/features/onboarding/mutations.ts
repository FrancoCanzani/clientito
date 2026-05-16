import { authClient } from "@/lib/auth-client";

export const GMAIL_SCOPES = [
 "https://www.googleapis.com/auth/gmail.readonly",
 "https://www.googleapis.com/auth/gmail.modify",
 "https://www.googleapis.com/auth/gmail.send",
 "https://www.googleapis.com/auth/gmail.settings.basic",
];

function withConnectionMarker(callbackURL: string, marker: string) {
 const separator = callbackURL.includes("?") ? "&" : "?";
 return `${callbackURL}${separator}${marker}=1`;
}

export async function beginGmailConnection(callbackURL = "/settings") {
 const result = await authClient.linkSocial({
 provider: "google",
 callbackURL: withConnectionMarker(callbackURL, "connected"),
 errorCallbackURL: withConnectionMarker(callbackURL, "connect_error"),
 scopes: GMAIL_SCOPES,
 });

 if (result?.error) {
 throw new Error(result.error.message || "Google connection failed.");
 }
}
