const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+$/i;

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function extractDomainFromEmail(email: string): string | null {
  const normalized = normalizeEmailAddress(email);
  const atIndex = normalized.indexOf("@");
  if (atIndex === -1 || atIndex === normalized.length - 1) {
    return null;
  }
  return normalized.slice(atIndex + 1);
}

export function sanitizeCandidateName(
  value: string | null | undefined,
  email: string,
): string | null {
  if (!value) return null;

  const trimmed = value.replace(/^["']|["']$/g, "").trim();
  if (!trimmed) return null;

  const normalizedEmail = normalizeEmailAddress(email);
  const lower = trimmed.toLowerCase();
  if (lower === normalizedEmail) {
    return null;
  }

  const domain = extractDomainFromEmail(normalizedEmail);
  if (domain && (lower === domain || lower === domain.replace(/\.[^.]+$/, ""))) {
    return null;
  }

  if (DOMAIN_PATTERN.test(lower)) {
    return null;
  }

  return trimmed;
}

export function deriveNameFromEmail(email: string): string {
  const normalized = normalizeEmailAddress(email);
  const localPart = normalized.split("@")[0] ?? "";
  if (!localPart) return normalized;

  const cleaned = localPart.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return normalized;

  return cleaned
    .split(" ")
    .map((part) =>
      part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part,
    )
    .join(" ");
}

export function resolveCustomerName(
  value: string | null | undefined,
  email: string,
): string {
  return sanitizeCandidateName(value, email) ?? deriveNameFromEmail(email);
}
