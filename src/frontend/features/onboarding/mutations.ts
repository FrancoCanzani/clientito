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

function readConnectURL(value: unknown): string | null {
 if (typeof value !== "object" || value === null) return null;
 const data = Reflect.get(value, "data");
 if (typeof data !== "object" || data === null) return null;
 const url = Reflect.get(data, "url");
 return typeof url === "string" ? url : null;
}

export async function beginGmailConnection(callbackURL = "/settings") {
 const response = await fetch("/api/settings/accounts/google/connect", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 callbackURL,
 errorCallbackURL: withConnectionMarker(callbackURL, "connect_error"),
 }),
 });
 if (!response.ok) {
 throw new Error("Google connection failed.");
 }
 const url = readConnectURL(await response.json());
 if (!url) {
 throw new Error("Google connection failed.");
 }
 window.location.assign(url);
}
