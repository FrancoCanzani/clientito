export type Participant = {
  email: string;
  name: string | null;
};

const EMAIL_REGEX = /<([^>]+)>/;

function parseOne(raw: string): Participant {
  raw = raw.trim();
  const match = raw.match(EMAIL_REGEX);
  if (match) {
    const email = match[1].trim().toLowerCase();
    const namePart = raw.slice(0, match.index).trim().replace(/^["']|["']$/g, "");
    return { email, name: namePart.length > 0 ? namePart : null };
  }
  const email = raw.toLowerCase();
  return { email, name: null };
}

export function parseParticipants(raw: string | null): Participant[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map(parseOne)
    .filter((p) => p.email.includes("@"));
}

export function extractDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";

  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain) return "";

  const parts = domain.split(".").filter(Boolean);
  if (parts.length <= 2) return domain;

  const secondToLast = parts[parts.length - 2];
  const multipartPrefixes = new Set(["co", "com", "org", "net", "edu", "gov"]);

  if (multipartPrefixes.has(secondToLast) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

export function getPrimaryPerson(
  from: Participant[],
  to: Participant[],
  cc: Participant[],
  userEmail: string,
  direction: "sent" | "received",
): Participant | null {
  const normalizedUserEmail = userEmail.toLowerCase();

  if (direction === "received") {
    return from.find((p) => p.email !== normalizedUserEmail) ?? from[0] ?? null;
  }

  // Sent: the primary person is the first recipient that isn't the user
  const allRecipients = [...to, ...cc];
  return (
    allRecipients.find((p) => p.email !== normalizedUserEmail) ??
    allRecipients[0] ??
    null
  );
}
