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
  "no_reply",
  "donotreply",
  "do-not-reply",
  "do_not_reply",
  "mailer-daemon",
  "postmaster",
  "bounce",
  "bounces",
  "unsubscribe",
  "unsub",
  "notifications",
  "notification",
  "notice",
  "notices",
  "newsletter",
  "digest",
  "alerts",
  "alert",
  "updates",
  "update",
  "marketing",
  "promo",
  "promotions",
  "surveys",
  "survey",
  "verify",
  "verification",
  "billing",
  "invoice",
  "receipts",
  "receipt",
  "security",
  "support",
  "system",
  "admin",
  "team",
];

const AUTOMATED_LOCAL_SUBSTRINGS = [
  "unsubscribe",
  "unsub",
  "bounce",
  "newsletter",
  "digest",
  "quora.com",
  "francocanzani=gmail.com",
];

const AUTOMATED_DOMAIN_PATTERNS = [
  "hubspotemail.net",
  "hubspotstarter.net",
  "hubspotservicehub.com",
  "intercom-mail.com",
  "customer.io",
  "mailjet.com",
  "senders.goto-",
  "cmail",
  "convertkit-mail.com",
  "unsubscribe2.customer.io",
  "bounce-us.",
  "bounce.",
];

const AUTOMATED_NAME_PATTERNS = [
  "suggested spaces",
  "digest",
  "newsletter",
  "customer service",
  "support",
  "notifications",
  "notification",
  "alert",
  "alerts",
  "events",
];

function hasRandomizedLocalPart(localPart: string): boolean {
  if (localPart.length < 24) {
    return false;
  }

  const normalized = localPart.replace(/[^a-z0-9]/g, "");
  if (normalized.length < 20) {
    return false;
  }

  const digitCount = (localPart.match(/\d/g) ?? []).length;
  const hyphenCount = (localPart.match(/-/g) ?? []).length;
  const vowelCount = (normalized.match(/[aeiou]/g) ?? []).length;

  return digitCount >= 4 || hyphenCount >= 3 || vowelCount <= 3;
}

export function isAutomatedSender(email: string, name?: string | null): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  const localPart = at >= 0 ? normalized.slice(0, at) : normalized;
  const domain = at >= 0 ? normalized.slice(at + 1) : "";
  const normalizedName = name?.trim().toLowerCase() ?? "";

  if (AUTOMATED_LOCAL_PREFIXES.some((prefix) => localPart.startsWith(prefix))) {
    return true;
  }

  if (
    AUTOMATED_LOCAL_SUBSTRINGS.some((substring) =>
      localPart.includes(substring),
    )
  ) {
    return true;
  }

  if (
    AUTOMATED_DOMAIN_PATTERNS.some((pattern) =>
      domain.includes(pattern),
    )
  ) {
    return true;
  }

  if (
    normalizedName &&
    AUTOMATED_NAME_PATTERNS.some((pattern) => normalizedName.includes(pattern))
  ) {
    return true;
  }

  return hasRandomizedLocalPart(localPart);
}
