import type { EmailAction } from "@/features/inbox/types";
import type { TaskPriority, TaskStatus } from "@/features/tasks/types";

export function getActionTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getSnoozeTimestamp(action: EmailAction) {
  if (action.type !== "snooze") return null;
  return getActionTimestamp(action.payload.until);
}

export function isSupportedAiAction(action: EmailAction) {
  if (action.status !== "pending") return false;
  if (action.type === "archive") return true;
  if (action.type === "snooze") return getSnoozeTimestamp(action) != null;
  if (
    action.type === "reply" &&
    typeof action.payload.draft === "string" &&
    action.payload.draft.trim()
  )
    return true;
  if (
    action.type === "create_task" &&
    typeof action.payload.taskTitle === "string" &&
    action.payload.taskTitle.trim()
  )
    return true;
  return false;
}

export function getAiActionButtonLabel(action: EmailAction) {
  if (action.type === "archive") return "Archive";
  if (action.type === "snooze") return "Snooze";
  if (action.type === "reply") return "Use suggested reply";
  if (action.type === "create_task") return "Create task";
  return action.label;
}

export function formatActionTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function getTaskPriority(payload: Record<string, unknown>) {
  return typeof payload.taskPriority === "string"
    ? (payload.taskPriority as TaskPriority)
    : undefined;
}

export function getTaskStatus(payload: Record<string, unknown>) {
  return typeof payload.taskStatus === "string"
    ? (payload.taskStatus as TaskStatus)
    : undefined;
}
