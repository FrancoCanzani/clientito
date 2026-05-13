export const deviceCapabilities = {
  get lowMemory() {
    return (
      typeof navigator !== "undefined" &&
      "deviceMemory" in navigator &&
      (navigator as unknown as { deviceMemory: number }).deviceMemory <= 2
    );
  },
  get lowCpu() {
    if (typeof navigator === "undefined") return false;
    const cores = navigator.hardwareConcurrency;
    return typeof cores === "number" && cores > 0 && cores <= 4;
  },
  get constrained() {
    return this.lowMemory || this.lowCpu;
  },
  get syncConcurrency() {
    return this.constrained ? 2 : 4;
  },
  get viewPageSize() {
    return this.constrained ? 15 : 25;
  },
  get shouldPrefetch() {
    return !this.constrained;
  },
  get maxSyncQueueSize() {
    return this.constrained ? 30 : 100;
  },
  get maxCacheTimeMs() {
    return this.constrained ? 5 * 60 * 1000 : 10 * 60 * 1000;
  },
  get deltaSyncIntervalMs() {
    if (this.lowCpu) return 180_000;
    if (this.lowMemory) return 120_000;
    return 60_000;
  },
  get insertChunkSize() {
    return this.constrained ? 25 : 50;
  },
};