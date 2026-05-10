const inFlightRequests = new Map<string, Promise<unknown>>();

export function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = fn().finally(() => inFlightRequests.delete(key));
  inFlightRequests.set(key, promise);
  return promise;
}
