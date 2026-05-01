import { cn } from "@/lib/utils";
import { formatInboxRowDate } from "@/features/email/inbox/utils/formatters";
import type { ThreadGroup } from "@/features/email/inbox/utils/group-emails-by-thread";

export function TodoQueuePanel({
  groups,
  selectedId,
  onSelect,
}: {
  groups: ThreadGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded border border-border/40 md:w-80 md:shrink-0">
      <div className="flex items-center justify-between px-3 py-2 text-xs">
        <h1>To do</h1>
        <span className="text-[10px] tabular-nums">{groups.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map((group) => {
          const email = group.representative;
          const sender = email.fromName?.trim() || email.fromAddr;
          const subject = email.subject?.trim() || "(no subject)";

          return (
            <button
              key={email.id}
              type="button"
              onClick={() => onSelect(email.id)}
              className={cn(
                "flex w-full flex-col gap-2 border-b border-dashed px-3 py-2 text-left transition-colors first:border-t hover:bg-muted",
                selectedId === email.id && "bg-muted",
              )}
            >
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="min-w-0 truncate text-blue-900 dark:text-blue-50">
                  {sender}
                </span>
                <span className="shrink-0 text-xs tabular-nums">
                  {formatInboxRowDate(email.date)}
                </span>
              </div>
              <p className="min-w-0 truncate text-xs">{subject}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
