import { Button } from "@/components/ui/button";
import { dbClient } from "@/db/worker-client";
import type { PerfStats } from "@/db/shared/types";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type Source = "worker" | "tab";
type Row = { label: string; source: Source } & PerfStats;
type SortKey = "label" | keyof PerfStats;

const REFRESH_MS = 1_000;

export default function PerformancePage() {
  const [snapshot, setSnapshot] = useState<{
    tab: Record<string, PerfStats>;
    worker: Record<string, PerfStats>;
  }>({ tab: {}, worker: {} });
  const [sortBy, setSortBy] = useState<SortKey>("p95");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await dbClient.stats();
        if (!cancelled) setSnapshot(next);
      } catch {}
    };
    void tick();
    const interval = window.setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const [label, stats] of Object.entries(snapshot.worker)) {
      out.push({ label, source: "worker", ...stats });
    }
    for (const [label, stats] of Object.entries(snapshot.tab)) {
      out.push({ label, source: "tab", ...stats });
    }
    return out.sort((a, b) => {
      if (sortBy === "label") return a.label.localeCompare(b.label);
      const av = a[sortBy];
      const bv = b[sortBy];
      return typeof av === "number" && typeof bv === "number" ? bv - av : 0;
    });
  }, [snapshot, sortBy]);

  const onClear = async () => {
    await dbClient.clearStats();
    setSnapshot({ tab: {}, worker: {} });
  };

  const onCopy = async () => {
    const header = "| label | src | count | avg | p50 | p95 | p99 | max |";
    const sep = "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |";
    const lines = rows.map(
      (r) =>
        `| ${r.label} | ${r.source} | ${r.count} | ${r.avg.toFixed(1)} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.p99.toFixed(1)} | ${r.max.toFixed(1)} |`,
    );
    const text = [header, sep, ...lines].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error("[perf] copy failed", err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {rows.length === 0
            ? "No samples yet — interact with the app to record measurements."
            : `${rows.length} ${rows.length === 1 ? "operation" : "operations"} tracked. All times in milliseconds.`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void onCopy()}
            disabled={rows.length === 0}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void onClear()}
            disabled={rows.length === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto border border-border/40">
        <table className="w-full border-collapse font-mono text-xs">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortHeader k="label" sortBy={sortBy} setSortBy={setSortBy} align="left">
                label
              </SortHeader>
              <th className="px-2 py-1.5 text-left font-medium">src</th>
              {(["count", "avg", "p50", "p95", "p99", "max"] as const).map(
                (k) => (
                  <SortHeader
                    key={k}
                    k={k}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    align="right"
                  >
                    {k}
                  </SortHeader>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  —
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.source}:${row.label}`}
                  className="border-t border-border/40"
                >
                  <td className="max-w-[14rem] truncate px-2 py-1.5" title={row.label}>
                    {row.label}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {row.source === "worker" ? "wkr" : "tab"}
                  </td>
                  <Cell>{row.count}</Cell>
                  <Cell warn={row.avg > 100}>{row.avg.toFixed(1)}</Cell>
                  <Cell warn={row.p50 > 100}>{row.p50.toFixed(1)}</Cell>
                  <Cell warn={row.p95 > 250}>{row.p95.toFixed(1)}</Cell>
                  <Cell warn={row.p99 > 500}>{row.p99.toFixed(1)}</Cell>
                  <Cell warn={row.max > 1000}>{row.max.toFixed(1)}</Cell>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({
  k,
  sortBy,
  setSortBy,
  align,
  children,
}: {
  k: SortKey;
  sortBy: SortKey;
  setSortBy: (k: SortKey) => void;
  align: "left" | "right";
  children: React.ReactNode;
}) {
  const active = sortBy === k;
  return (
    <th
      className={cn(
        "cursor-pointer select-none px-2 py-1.5 font-medium transition-colors hover:text-foreground",
        align === "right" ? "text-right" : "text-left",
        active && "text-foreground",
      )}
      onClick={() => setSortBy(k)}
    >
      {children}
      {active && <span className="ml-1 text-[8px]">▼</span>}
    </th>
  );
}

function Cell({
  children,
  warn,
}: {
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-2 py-1.5 text-right tabular-nums",
        warn && "text-amber-600 dark:text-amber-400",
      )}
    >
      {children}
    </td>
  );
}
