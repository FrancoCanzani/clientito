import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FOCUS_WINDOW_ENDED_EVENT,
  useFocusWindow,
  type FocusWindowEndedDetail,
} from "./use-focus-window";

const SECOND = 1_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const PRESETS = [
  { label: "30 minutes", durationMs: 30 * MINUTE },
  { label: "1 hour", durationMs: HOUR },
  { label: "2 hours", durationMs: 2 * HOUR },
  { label: "4 hours", durationMs: 4 * HOUR },
];

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours <= 0) return `${mm}:${ss}`;
  return `${hours}:${mm}:${ss}`;
}

function useNow(intervalMs: number, enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}

export function FocusWindowToggle() {
  const focusWindow = useFocusWindow();
  const now = useNow(SECOND, focusWindow.active && focusWindow.endsAt !== null);

  useEffect(() => {
    const onEnded = (event: Event) => {
      const detail = (event as CustomEvent<FocusWindowEndedDetail>).detail;
      const heldCount = detail?.heldCount ?? 0;
      toast(
        `Focus ended: ${heldCount} ${
          heldCount === 1 ? "email" : "emails"
        } held during Focus`,
      );
    };
    window.addEventListener(FOCUS_WINDOW_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(FOCUS_WINDOW_ENDED_EVENT, onEnded);
  }, []);

  const remainingLabel =
    focusWindow.active && focusWindow.endsAt
      ? formatRemaining(focusWindow.endsAt - now)
      : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size={"sm"}
          aria-pressed={focusWindow.active}
          title={focusWindow.active ? "Focus is active" : "Start Focus"}
          className={cn(
            focusWindow.active &&
              "bg-foreground text-background hover:bg-foreground/90",
          )}
        >
          <span>
            {focusWindow.active
              ? remainingLabel
                ? `Focus · ${remainingLabel}`
                : "Focus"
              : "Focus"}
          </span>
          {focusWindow.active && (
            <span className="font-mono text-[10px] tracking-tighter tabular-nums opacity-90">
              {`· ${focusWindow.heldCount}`}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="whitespace-normal text-[11px] leading-snug text-muted-foreground">
          Only important mail gets through.
        </DropdownMenuLabel>
        {focusWindow.active ? (
          <DropdownMenuItem onSelect={() => focusWindow.stop()}>
            Stop Focus
          </DropdownMenuItem>
        ) : (
          PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.label}
              onSelect={() => focusWindow.start(preset.durationMs)}
            >
              {preset.label}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
