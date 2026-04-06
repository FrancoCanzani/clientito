const SESSION_AFFINITY_HEADER = "x-session-affinity";

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function sanitizeScope(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20) || "session";
}

export function buildSessionAffinityKey(
  scope: string,
  ...parts: Array<string | number | null | undefined>
) {
  const seed = [scope, ...parts].filter((part) => part !== null && part !== undefined).join(":");
  const hash = stableHash(seed).toString(36);
  return `${sanitizeScope(scope)}_${hash}`;
}

export function withSessionAffinity(sessionAffinityKey: string) {
  return {
    extraHeaders: {
      [SESSION_AFFINITY_HEADER]: sessionAffinityKey,
    },
  };
}

