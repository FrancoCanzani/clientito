export type TemplateContext = {
  to: { firstName: string; fullName: string; email: string; domain: string };
  from: { firstName: string; fullName: string; email: string };
  subject: string;
  date: string;
  day: string;
  time: string;
};

export const TEMPLATE_VARIABLES = [
  { token: "{{to.firstName}}", description: "Recipient first name" },
  { token: "{{to.fullName}}", description: "Recipient full name" },
  { token: "{{to.email}}", description: "Recipient email" },
  { token: "{{to.domain}}", description: "Recipient domain" },
  { token: "{{from.firstName}}", description: "Your first name" },
  { token: "{{from.fullName}}", description: "Your full name" },
  { token: "{{from.email}}", description: "Your email" },
  { token: "{{subject}}", description: "Current subject" },
  { token: "{{date}}", description: "Today's date" },
  { token: "{{day}}", description: "Day of week" },
  { token: "{{time}}", description: "Current time" },
] as const;

const TOKEN_PATTERN = /{{\s*([\w.]+)\s*}}/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function lookup(ctx: TemplateContext, path: string): string | null {
  const segments = path.split(".");
  let cursor: unknown = ctx;
  for (const segment of segments) {
    if (cursor && typeof cursor === "object" && segment in cursor) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return null;
    }
  }
  if (typeof cursor === "string" && cursor.length > 0) return cursor;
  return null;
}

export function interpolatePlain(text: string, ctx: TemplateContext): string {
  return text.replace(TOKEN_PATTERN, (match, path: string) => {
    const value = lookup(ctx, path);
    return value ?? match;
  });
}

export function interpolateHtml(html: string, ctx: TemplateContext): string {
  return html.replace(TOKEN_PATTERN, (match, path: string) => {
    const value = lookup(ctx, path);
    return value != null ? escapeHtml(value) : match;
  });
}

export function countUnresolved(text: string): number {
  const matches = text.match(TOKEN_PATTERN);
  return matches ? matches.length : 0;
}

const ANGLE_ADDR = /^(.*?)<\s*([^>]+)\s*>\s*$/;

export function parseRecipient(raw: string): {
  email: string;
  name: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const angle = trimmed.match(ANGLE_ADDR);
  if (angle) {
    const name = angle[1].trim().replace(/^"(.*)"$/, "$1");
    return { email: angle[2].trim(), name };
  }
  if (trimmed.includes("@")) return { email: trimmed, name: "" };
  return null;
}

function firstRecipient(raw: string): string {
  const first = raw.split(/[,;]/)[0] ?? "";
  return first.trim();
}

function deriveName(name: string, email: string): string {
  if (name) return name;
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function firstWord(value: string): string {
  return value.split(/\s+/)[0] ?? "";
}

export function buildTemplateContext(input: {
  to: string;
  subject: string;
  fromEmail: string | null;
  fromName: string | null;
  now?: Date;
  locale?: string;
}): TemplateContext {
  const recipient = parseRecipient(firstRecipient(input.to));
  const toEmail = recipient?.email ?? "";
  const toName = recipient ? deriveName(recipient.name, recipient.email) : "";
  const toDomain = toEmail.includes("@") ? toEmail.split("@")[1] ?? "" : "";

  const fromEmail = input.fromEmail ?? "";
  const fromName = deriveName(input.fromName ?? "", fromEmail);

  const now = input.now ?? new Date();
  const locale = input.locale;

  return {
    to: {
      email: toEmail,
      fullName: toName,
      firstName: firstWord(toName),
      domain: toDomain,
    },
    from: {
      email: fromEmail,
      fullName: fromName,
      firstName: firstWord(fromName),
    },
    subject: input.subject ?? "",
    date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(now),
    day: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(now),
    time: new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(now),
  };
}
