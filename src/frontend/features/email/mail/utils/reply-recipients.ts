function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

function parseRecipientList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => extractEmailAddress(s))
    .filter((s) => s.length > 0);
}

export function buildReplyAllRecipients(
  fromAddr: string,
  toAddr: string | null,
  ccAddr: string | null,
  myEmail: string,
) {
  const toRecipients = parseRecipientList(toAddr);
  const ccRecipients = parseRecipientList(ccAddr);
  const from = extractEmailAddress(fromAddr);

  const replyTo = from;
  const allOthers = [...toRecipients, ...ccRecipients].filter(
    (addr) => addr !== myEmail.toLowerCase() && addr !== from,
  );
  const uniqueCc = [...new Set(allOthers)].join(", ");

  return { replyTo, cc: uniqueCc || undefined };
}
