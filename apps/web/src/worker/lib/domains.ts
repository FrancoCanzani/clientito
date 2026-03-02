export const PUBLIC_DOMAINS = new Set([
  "gmail.com",
  "google.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.jp",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "outlook.co.uk",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "yandex.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "fastmail.com",
  "tutanota.com",
  "hey.com",
  "linkedin.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "github.com",
  "noreply.github.com",
  "mailchimp.com",
  "sendgrid.net",
  "amazonses.com",
  "mandrillapp.com",
]);

export function isPublicDomain(domain: string): boolean {
  return PUBLIC_DOMAINS.has(domain.toLowerCase());
}

const AUTOMATED_LOCAL_PREFIXES = [
  "noreply",
  "no-reply",
  "donotreply",
  "mailer-daemon",
];

export function isAutomatedSender(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  const localPart = at >= 0 ? normalized.slice(0, at) : normalized;
  return AUTOMATED_LOCAL_PREFIXES.some((prefix) => localPart.startsWith(prefix));
}
