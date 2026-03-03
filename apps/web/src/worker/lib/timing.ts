type TimerMeta = Record<string, unknown>;

export function createTimer(label: string, meta?: TimerMeta) {
  const start = Date.now();
  const marks: Record<string, number> = {};

  return {
    mark(name: string) {
      marks[name] = Date.now() - start;
    },
    end(extra?: TimerMeta) {
      console.info(`[timing] ${label}`, {
        totalMs: Date.now() - start,
        ...meta,
        ...extra,
        marks,
      });
    },
  };
}

