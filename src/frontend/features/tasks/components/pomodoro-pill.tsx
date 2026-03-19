import { Button } from "@/components/ui/button";
import {
  formatTime,
  type PomodoroState,
} from "@/features/tasks/hooks/use-pomodoro";
import { cn } from "@/lib/utils";
import {
  FastForwardIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
} from "@phosphor-icons/react";

const PHASE_LABELS: Record<PomodoroState["phase"], string> = {
  work: "Focus",
  break: "Break",
  longBreak: "Long break",
};

export function PomodoroPill({
  state,
  onStart,
  onPause,
  onStop,
  onSkip,
}: {
  state: PomodoroState;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onSkip: () => void;
}) {
  if (state.status === "idle") return null;

  const progress = 1 - state.secondsLeft / state.totalSeconds;

  return (
    <div className="fixed bottom-20 right-6 z-40 flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 shadow-md">
      <div className="relative size-6">
        <svg className="size-6 -rotate-90" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-border"
          />
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${progress * 62.83} 62.83`}
            className={cn(
              state.phase === "work" ? "text-red-500" : "text-green-500",
            )}
          />
        </svg>
      </div>

      <div className="flex flex-col">
        <span className="text-xs font-medium leading-tight">
          {PHASE_LABELS[state.phase]}
          {state.taskTitle && (
            <span className="ml-1 font-normal text-muted-foreground">
              · {state.taskTitle}
            </span>
          )}
        </span>
        <span className="font-mono text-xs font-semibold tabular-nums leading-tight">
          {formatTime(state.secondsLeft)}
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        {state.status === "running" ? (
          <Button variant="ghost" size="icon" onClick={onPause} title="Pause">
            <PauseIcon className="size-3" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={onStart} title="Resume">
            <PlayIcon className="size-3" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onSkip} title="Skip">
          <FastForwardIcon className="size-3" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onStop} title="Stop">
          <StopIcon className="size-3" />
        </Button>
      </div>
    </div>
  );
}
