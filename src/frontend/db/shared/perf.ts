// Lightweight performance bookkeeping shared between the worker and the tab.
//
// Each sample emits a `performance.measure` so the operation shows up in the
// DevTools Performance panel without any extra wiring, and is recorded into
// an in-memory ring buffer so consumers can fetch summary statistics
// (p50/p95/p99/max/count) without enabling tracing.

const RING_CAPACITY = 200;

type Bucket = {
  samples: number[];
  index: number;
  count: number;
};

const buckets = new Map<string, Bucket>();

function getBucket(label: string): Bucket {
  let bucket = buckets.get(label);
  if (!bucket) {
    bucket = { samples: new Array(RING_CAPACITY).fill(0), index: 0, count: 0 };
    buckets.set(label, bucket);
  }
  return bucket;
}

export function recordSample(label: string, durationMs: number, startMs?: number): void {
  const bucket = getBucket(label);
  bucket.samples[bucket.index] = durationMs;
  bucket.index = (bucket.index + 1) % RING_CAPACITY;
  bucket.count++;
  if (typeof performance !== "undefined" && typeof performance.measure === "function") {
    try {
      performance.measure(label, {
        start: startMs ?? performance.now() - durationMs,
        duration: durationMs,
      });
    } catch {}
  }
}

export type LabelStats = {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  avg: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function getStats(): Record<string, LabelStats> {
  const result: Record<string, LabelStats> = {};
  for (const [label, bucket] of buckets) {
    const filled = Math.min(bucket.count, RING_CAPACITY);
    if (filled === 0) continue;
    const sorted = bucket.samples.slice(0, filled).sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    result[label] = {
      count: bucket.count,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1],
      avg: sum / filled,
    };
  }
  return result;
}

export function clearStats(): void {
  buckets.clear();
}
