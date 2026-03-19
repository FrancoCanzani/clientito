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

