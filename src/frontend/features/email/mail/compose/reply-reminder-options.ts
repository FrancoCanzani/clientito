const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type ReplyReminderOption = {
 id: string;
 label: string;
 durationMs: number;
};

export const REPLY_REMINDER_OPTIONS: ReplyReminderOption[] = [
 { id: "1d", label: "1 day", durationMs: ONE_DAY_MS },
 { id: "3d", label: "3 days", durationMs: 3 * ONE_DAY_MS },
 { id: "1w", label: "1 week", durationMs: 7 * ONE_DAY_MS },
 { id: "2w", label: "2 weeks", durationMs: 14 * ONE_DAY_MS },
];

export function formatReminderLabel(durationMs: number): string {
 const option = REPLY_REMINDER_OPTIONS.find((o) => o.durationMs === durationMs);
 return option?.label ?? `${Math.round(durationMs / ONE_DAY_MS)} days`;
}
