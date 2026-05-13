import { dbClient } from "@/db/worker-client";
import type { PerfStats } from "@/db/shared/types";
import { useEffect, useMemo, useState } from "react";

type Source = "worker" | "tab";
type Row = { label: string; source: Source } & PerfStats;

const REFRESH_MS = 1000;

export function DbPerfOverlay() {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "p" &&
        e.shiftKey &&
        (e.metaKey || e.ctrlKey)
      ) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [snapshot, setSnapshot] = useState<{
    tab: Record<string, PerfStats>;
    worker: Record<string, PerfStats>;
  }>({ tab: {}, worker: {} });
  const [sortBy, setSortBy] = useState<keyof PerfStats>("p95");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const copyAsMarkdown = async (data: Row[]) => {
    const header = "| label | src | count | avg | p50 | p95 | p99 | max |";
    const sep = "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |";
    const lines = data.map(
      (r) =>
        `| ${r.label} | ${r.source} | ${r.count} | ${r.avg.toFixed(1)} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.p99.toFixed(1)} | ${r.max.toFixed(1)} |`,
    );
    const text = [header, sep, ...lines].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error("[db-perf] copy failed", err);
    }
  };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const [label, stats] of Object.entries(snapshot.worker)) {
      out.push({ label, source: "worker", ...stats });
    }
    for (const [label, stats] of Object.entries(snapshot.tab)) {
      out.push({ label, source: "tab", ...stats });
    }
    return out.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      return typeof av === "number" && typeof bv === "number" ? bv - av : 0;
    });
  }, [snapshot, sortBy]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="fixed bottom-3 right-3 z-[9999] rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-1 font-mono text-[10px] text-zinc-300 shadow-lg backdrop-blur hover:bg-zinc-800"
        title="DB perf (Cmd+Shift+P)"
      >
        db perf
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-[9999] flex max-h-[70vh] w-[640px] flex-col overflow-hidden rounded-md border border-zinc-700 bg-zinc-950/95 text-xs text-zinc-200 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          db perf · live ({rows.length})
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copyAsMarkdown(rows)}
            disabled={rows.length === 0}
            className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            {copied ? "copied" : "copy"}
          </button>
          <button
            type="button"
            onClick={() =>
              void dbClient
                .clearStats()
                .then(() => setSnapshot({ tab: {}, worker: {} }))
            }
            className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300 hover:bg-zinc-800"
          >
            clear
          </button>
          <button
            type="button"
            onClick={toggle}
            className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300 hover:bg-zinc-800"
          >
            close
          </button>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead className="sticky top-0 bg-zinc-900 text-[10px] uppercase text-zinc-400">
            <tr>
              <Th>label</Th>
              <Th>src</Th>
              {(["count", "avg", "p50", "p95", "p99", "max"] as const).map((k) => (
                <Th
                  key={k}
                  active={sortBy === k}
                  onClick={() => setSortBy(k)}
                  align="right"
                >
                  {k}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-zinc-500">
                  no samples yet — interact with the app
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={`${row.source}:${row.label}`}
                className="border-t border-zinc-900 hover:bg-zinc-900/60"
              >
                <td className="truncate px-3 py-1 text-zinc-200" title={row.label}>
                  {row.label}
                </td>
                <td className="px-2 py-1 text-zinc-500">
                  {row.source === "worker" ? "wkr" : "tab"}
                </td>
                <Td>{row.count}</Td>
                <Td warn={row.avg > 100}>{row.avg.toFixed(1)}</Td>
                <Td warn={row.p50 > 100}>{row.p50.toFixed(1)}</Td>
                <Td warn={row.p95 > 250}>{row.p95.toFixed(1)}</Td>
                <Td warn={row.p99 > 500}>{row.p99.toFixed(1)}</Td>
                <Td warn={row.max > 1000}>{row.max.toFixed(1)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-zinc-800 px-3 py-1 text-[10px] text-zinc-500">
        Cmd+Shift+P to toggle · click a header to sort
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-2 py-1 font-normal ${align === "right" ? "text-right" : "text-left"} ${onClick ? "cursor-pointer hover:text-zinc-200" : ""} ${active ? "text-zinc-100" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  warn = false,
}: {
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <td
      className={`px-2 py-1 text-right tabular-nums ${warn ? "text-amber-400" : "text-zinc-300"}`}
    >
      {children}
    </td>
  );
}
