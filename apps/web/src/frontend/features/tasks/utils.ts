import * as chrono from "chrono-node";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import type { Task, TaskPriority } from "./types";

export type TaskSection = {
  key: string;
  title: string;
  tasks: Task[];
};

export function parseTaskInput(input: string): {
  title: string;
  dueAt?: number;
} {
  const raw = input.trim();
  if (!raw) {
    return { title: "" };
  }

  const matches = chrono.parse(raw, new Date(), { forwardDate: true });
  const first = matches[0];

  if (!first) {
    return { title: raw };
  }

  const dueAt = first.start.date().getTime();
  const before = raw.slice(0, first.index).trim();
  const after = raw.slice(first.index + first.text.length).trim();
  const title = `${before} ${after}`.trim() || raw;

  return { title, dueAt };
}

export function getPriorityClassName(priority: TaskPriority) {
  switch (priority) {
    case "urgent":
      return "bg-red-50 text-red-700";
    case "high":
      return "bg-amber-50 text-amber-700";
    case "medium":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

export function buildTaskSections(
  tasks: Task[],
  sortMode: "date" | "priority",
): TaskSection[] {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    const key = getTaskDateKey(task.dueAt);
    const group = groups.get(key);
    if (group) {
      group.push(task);
      continue;
    }
    groups.set(key, [task]);
  }

  return [...groups.entries()]
    .sort(([leftKey], [rightKey]) => compareSectionKeys(leftKey, rightKey))
    .map(([key, groupTasks]) => ({
      key,
      ...getSectionLabel(key),
      tasks: [...groupTasks].sort((left, right) =>
        sortMode === "priority"
          ? compareTasksByPriority(left, right)
          : compareTasksByDate(left, right),
      ),
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
  if (key === "no-date") {
    return { title: "No date" };
  }

  const date = parseISO(key);
  if (isToday(date)) {
    return { title: "Today" };
  }
  if (isTomorrow(date)) {
    return { title: "Tomorrow" };
  }
  if (isYesterday(date)) {
    return { title: "Yesterday" };
  }

  return {
    title: format(date, "EEE, MMM d"),
  };
}

function compareTasksByDate(left: Task, right: Task) {
  const leftDueAt = left.dueAt ?? Number.MAX_SAFE_INTEGER;
  const rightDueAt = right.dueAt ?? Number.MAX_SAFE_INTEGER;

  if (leftDueAt !== rightDueAt) {
    return leftDueAt - rightDueAt;
  }

  return right.createdAt - left.createdAt;
}

function compareTasksByPriority(left: Task, right: Task) {
  if (left.priority !== right.priority) {
    return getPriorityOrder(left.priority) - getPriorityOrder(right.priority);
  }

  return compareTasksByDate(left, right);
}

function getPriorityOrder(priority: TaskPriority) {
  switch (priority) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    default:
      return 3;
  }
}
