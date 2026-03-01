function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function getAiErrorCode(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const withCode = error as {
    code?: unknown;
    errorCode?: unknown;
    message?: unknown;
  };

  const directCode = toNumber(withCode.code) ?? toNumber(withCode.errorCode);
  if (directCode !== null) {
    return directCode;
  }

  if (typeof withCode.message !== "string") {
    return null;
  }

  const match = withCode.message.match(/error code:\s*(\d+)/i);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

export type AiErrorDetails = {
  name: string;
  message: string;
  code: number | null;
  causeName: string | null;
  causeMessage: string | null;
  stackTop: string | null;
  meta: Record<string, string | number | boolean | null>;
};

function toMetaRecord(error: Record<string, unknown>) {
  const meta: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(error)) {
    if (key === "name" || key === "message" || key === "stack" || key === "cause") {
      continue;
    }
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      meta[key] = value;
    }
  }
  return meta;
}

export function getAiErrorDetails(error: unknown): AiErrorDetails {
  if (!error || typeof error !== "object") {
    return {
      name: "UnknownError",
      message: typeof error === "string" ? error : "Unknown AI error",
      code: null,
      causeName: null,
      causeMessage: null,
      stackTop: null,
      meta: {},
    };
  }

  const record = error as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : "Error";
  const message = typeof record.message === "string" ? record.message : "Unknown AI error";
  const code = getAiErrorCode(error);
  const stackTop =
    typeof record.stack === "string" ? (record.stack.split("\n")[0] ?? null) : null;

  const cause =
    "cause" in record && record.cause && typeof record.cause === "object"
      ? (record.cause as Record<string, unknown>)
      : null;

  const causeName = cause && typeof cause.name === "string" ? cause.name : null;
  const causeMessage = cause && typeof cause.message === "string" ? cause.message : null;

  return {
    name,
    message,
    code,
    causeName,
    causeMessage,
    stackTop,
    meta: toMetaRecord(record),
  };
}
