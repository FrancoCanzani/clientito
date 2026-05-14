const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 75;
const statementTargets = new WeakMap<object, D1PreparedStatement>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorCause(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}

function isWriteQuery(sql: string): boolean {
  const head = sql.trimStart().slice(0, 16).toUpperCase();
  return (
    head.startsWith("INSERT") ||
    head.startsWith("UPDATE") ||
    head.startsWith("DELETE") ||
    head.startsWith("REPLACE") ||
    head.startsWith("CREATE") ||
    head.startsWith("DROP") ||
    head.startsWith("ALTER")
  );
}

function isTransientD1Error(error: unknown): boolean {
  const text = `${errorMessage(error)} ${errorMessage(errorCause(error))}`.toLowerCase();
  return (
    text.includes("d1_error") ||
    text.includes("internal error") ||
    text.includes("database is locked") ||
    text.includes("sqlITE_busy".toLowerCase()) ||
    text.includes("storage caused object to be reset") ||
    text.includes("network") ||
    text.includes("timed out") ||
    text.includes("timeout") ||
    text.includes("temporarily unavailable")
  );
}

function summarizeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { message: String(error) };
  return {
    name: error.name,
    message: error.message,
    cause: error.cause instanceof Error
      ? { name: error.cause.name, message: error.cause.message }
      : error.cause == null
        ? undefined
        : String(error.cause),
  };
}

async function withD1Retry<T>(
  sql: string,
  op: string,
  run: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  const write = isWriteQuery(sql);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const transient = isTransientD1Error(error);
      if (!transient || attempt >= MAX_ATTEMPTS) {
        console.error("[d1] query failed", {
          op,
          attempt,
          write,
          transient,
          sql,
          error: summarizeError(error),
        });
        throw error;
      }

      console.warn("[d1] transient query failure; retrying", {
        op,
        attempt,
        write,
        sql,
        error: summarizeError(error),
      });
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

function wrapStatement(
  statement: D1PreparedStatement,
  sql: string,
): D1PreparedStatement {
  const proxy = new Proxy(statement, {
    get(target, prop, receiver) {
      if (prop === "bind") {
        return (...values: unknown[]) =>
          wrapStatement(target.bind(...values), sql);
      }

      if (
        prop === "all" ||
        prop === "first" ||
        prop === "run" ||
        prop === "raw"
      ) {
        return (...args: unknown[]) =>
          withD1Retry(sql, String(prop), () =>
            Reflect.apply(Reflect.get(target, prop, receiver), target, args),
          );
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as D1PreparedStatement;
  statementTargets.set(proxy, statement);
  return proxy;
}

function wrapSession(session: D1DatabaseSession): D1DatabaseSession {
  return new Proxy(session, {
    get(target, prop, receiver) {
      if (prop === "prepare") {
        return (sql: string) => wrapStatement(target.prepare(sql), sql);
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as D1DatabaseSession;
}

export function createResilientD1(d1: D1Database): D1Database {
  return new Proxy(d1, {
    get(target, prop, receiver) {
      if (prop === "prepare") {
        return (sql: string) => wrapStatement(target.prepare(sql), sql);
      }
      if (prop === "exec") {
        return (sql: string) =>
          withD1Retry(sql, "exec", () => target.exec(sql));
      }
      if (prop === "batch") {
        return <T = unknown>(statements: D1PreparedStatement[]) =>
          withD1Retry("<batch>", "batch", () =>
            target.batch<T>(
              statements.map((statement) =>
                statementTargets.get(statement) ?? statement,
              ),
            ),
          );
      }
      if (prop === "withSession") {
        return (
          constraintOrBookmark?: D1SessionBookmark | D1SessionConstraint,
        ) => wrapSession(target.withSession(constraintOrBookmark));
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as D1Database;
}
