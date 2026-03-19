import * as chrono from "chrono-node";
import {
  format,
  isPast,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from "date-fns";
import type { Task, TaskPriority, TaskStatus, TaskView } from "./types";

export type TaskSection = {
  key: string;
  title: string;
  tasks: Task[];
};

export const VIEW_LABELS: Record<TaskView, string> = {
  all: "All Tasks",
  today: "Today",
  upcoming: "Upcoming",
};

export function getDefaultCreateDueAt() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date.getTime();
}

export function parseTaskInput(input: string): {
  title: string;
  dueAt?: number;
} {
  const raw = input.trim();
  if (!raw) return { title: "" };

  const matches = chrono.parse(raw, new Date(), { forwardDate: true });
  const first = matches[0];
  if (!first) return { title: raw };

  const dueAt = first.start.date().getTime();
  const before = raw.slice(0, first.index).trim();
  const after = raw.slice(first.index + first.text.length).trim();
  const title = `${before} ${after}`.trim() || raw;
  return { title, dueAt };
}

export function getPriorityFlagClassName(priority: TaskPriority) {
  switch (priority) {
    case "urgent":
      return "text-red-500 size-3";
    case "high":
      return "text-amber-500 size-3";
    case "medium":
      return "text-blue-500 size-3";
    default:
      return "text-zinc-500 size-3";
  }
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
};

export const STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
];

export function isOverdue(task: Task): boolean {
  if (task.status === "done" || !task.dueAt) return false;
  return isPast(new Date(task.dueAt)) && !isToday(new Date(task.dueAt));
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_SECTION_ORDER: TaskPriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
];

export function buildTaskSections(
  tasks: Task[],
  sortMode: "date" | "priority",
): TaskSection[] {
  const groups = new Map<string, Task[]>();

  if (sortMode === "priority") {
    for (const task of tasks) {
      const key = task.priority;
      const group = groups.get(key);
      if (group) {
        group.push(task);
      } else {
        groups.set(key, [task]);
      }
    }

    return PRIORITY_SECTION_ORDER.filter((p) => groups.has(p)).map((p) => ({
      key: p,
      title: PRIORITY_LABELS[p],
      tasks: [...groups.get(p)!].sort(compareTasksByDate),
    }));
  }

  for (const task of tasks) {
    const key = getTaskDateKey(task.dueAt);
    const group = groups.get(key);
    if (group) {
      group.push(task);
    } else {
      groups.set(key, [task]);
    }
  }

  return [...groups.entries()]
    .sort(([leftKey], [rightKey]) => compareSectionKeys(leftKey, rightKey))
    .map(([key, groupTasks]) => ({
      key,
      ...getSectionLabel(key),
      tasks: [...groupTasks].sort(compareTasksByDate),
    }));
}

export function toTaskDateInputValue(timestamp: number | null | undefined) {
  if (!timestamp) return "";
  return format(new Date(timestamp), "yyyy-MM-dd");
}

export function fromTaskDateInputValue(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

function getTaskDateKey(timestamp: number | null) {
  if (!timestamp) return "no-date";
  return format(new Date(timestamp), "yyyy-MM-dd");
}

function compareSectionKeys(leftKey: string, rightKey: string) {
  if (leftKey === "no-date") return 1;
  if (rightKey === "no-date") return -1;
  return leftKey.localeCompare(rightKey);
}

function getSectionLabel(key: string) {
  if (key === "no-date") return { title: "No date" };
  const date = parseISO(key);
  if (isToday(date)) return { title: "Today" };
  if (isTomorrow(date)) return { title: "Tomorrow" };
  if (isYesterday(date)) return { title: "Yesterday" };
  return { title: format(date, "EEE, MMM d") };
}

function compareTasksByDate(left: Task, right: Task) {
  const leftDueAt = left.dueAt ?? Number.MAX_SAFE_INTEGER;
  const rightDueAt = right.dueAt ?? Number.MAX_SAFE_INTEGER;
  if (leftDueAt !== rightDueAt) return leftDueAt - rightDueAt;
  return left.position - right.position;
}
