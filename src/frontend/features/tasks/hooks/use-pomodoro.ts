import { useCallback, useEffect, useRef, useState } from "react";

type PomodoroPhase = "work" | "break" | "longBreak";
type PomodoroStatus = "idle" | "running" | "paused";

const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
const LONG_BREAK_DURATION = 15 * 60;
const SESSIONS_BEFORE_LONG_BREAK = 4;

export type PomodoroState = {
  status: PomodoroStatus;
  phase: PomodoroPhase;
  secondsLeft: number;
  totalSeconds: number;
  sessionsCompleted: number;
  taskId: number | null;
  taskTitle: string | null;
};

export function usePomodoro() {
  const [status, setStatus] = useState<PomodoroStatus>("idle");
  const [phase, setPhase] = useState<PomodoroPhase>("work");
  const [secondsLeft, setSecondsLeft] = useState(WORK_DURATION);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(phase);
  const sessionsRef = useRef(sessionsCompleted);
  phaseRef.current = phase;
  sessionsRef.current = sessionsCompleted;

  const totalSeconds =
    phase === "work"
      ? WORK_DURATION
      : phase === "longBreak"
        ? LONG_BREAK_DURATION
        : BREAK_DURATION;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const notify = useCallback((title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }, []);

  const startNextPhase = useCallback(
    (currentPhase: PomodoroPhase, sessions: number) => {
      if (currentPhase === "work") {
        const newSessions = sessions + 1;
        setSessionsCompleted(newSessions);
        if (newSessions % SESSIONS_BEFORE_LONG_BREAK === 0) {
          setPhase("longBreak");
          setSecondsLeft(LONG_BREAK_DURATION);
          notify("Long break", "Take a 15 minute break.");
        } else {
          setPhase("break");
          setSecondsLeft(BREAK_DURATION);
          notify("Break time", "Take a 5 minute break.");
        }
      } else {
        setPhase("work");
        setSecondsLeft(WORK_DURATION);
        notify("Back to work", taskTitle ? `Focus: ${taskTitle}` : "Time to focus.");
      }
      setStatus("running");
    },
    [notify, taskTitle],
  );

  useEffect(() => {
    if (status !== "running") {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          startNextPhase(phaseRef.current, sessionsRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [status, clearTimer, startNextPhase]);

  const start = useCallback(
    (forTaskId?: number, forTaskTitle?: string) => {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
      if (forTaskId !== undefined) {
        setTaskId(forTaskId);
        setTaskTitle(forTaskTitle ?? null);
      }
      if (status === "paused") {
        setStatus("running");
      } else {
        setPhase("work");
        setSecondsLeft(WORK_DURATION);
        setSessionsCompleted(0);
        setStatus("running");
      }
    },
    [status],
  );

  const pause = useCallback(() => {
    setStatus("paused");
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    setStatus("idle");
    setPhase("work");
    setSecondsLeft(WORK_DURATION);
    setTaskId(null);
    setTaskTitle(null);
    setSessionsCompleted(0);
  }, [clearTimer]);

  const skip = useCallback(() => {
    startNextPhase(phase, sessionsCompleted);
  }, [phase, sessionsCompleted, startNextPhase]);

  return {
    state: {
      status,
      phase,
      secondsLeft,
      totalSeconds,
      sessionsCompleted,
      taskId,
      taskTitle,
    } satisfies PomodoroState,
    start,
    pause,
    stop,
    skip,
  };
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
