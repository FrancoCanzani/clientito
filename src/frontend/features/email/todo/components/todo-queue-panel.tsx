import { cn } from "@/lib/utils";
import { formatInboxRowDate } from "@/features/email/mail/utils/formatters";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
import { useEffect, useRef } from "react";

export function TodoQueuePanel({
 groups,
 selectedId,
 onSelect,
 className,
}: {
 groups: ThreadGroup[];
 selectedId: string | null;
 onSelect: (id: string) => void;
 className?: string;
}) {
 const rowRefs = useRef(new Map<string, HTMLButtonElement>());

 useEffect(() => {
 if (!selectedId) return;
 rowRefs.current.get(selectedId)?.scrollIntoView({
 block: "nearest",
 });
 }, [selectedId]);

 return (
 <section
 className={cn(
 "flex min-h-0 flex-1 flex-col overflow-hidden border border-border/40 md:flex-initial md:w-80 md:shrink-0",
 className,
 )}
 >
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
 ref={(node) => {
 if (node) rowRefs.current.set(email.id, node);
 else rowRefs.current.delete(email.id);
 }}
 type="button"
 onClick={() => onSelect(email.id)}
 className={cn(
 "flex w-full flex-col gap-2 border-b border-dashed px-3 py-2 text-left transition-colors first:border-t hover:bg-muted",
 selectedId === email.id && "bg-muted",
 )}
 >
 <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
 <span className="min-w-0 truncate text-primary">
 {sender}
 </span>
 <span className="shrink-0 font-mono text-[10px] tracking-tighter tabular-nums">
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
