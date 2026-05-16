import { Button } from "@/components/ui/button";
import type { MailListFilters } from "@/features/email/mail/shared/hooks/use-mail-view-data";
import { cn } from "@/lib/utils";
import {
 EnvelopeSimpleIcon,
 PaperclipIcon,
 StarIcon,
 XIcon,
} from "@phosphor-icons/react";

type FilterKey = keyof MailListFilters;

const FILTERS: {
 key: FilterKey;
 label: string;
 icon: typeof StarIcon;
}[] = [
 { key: "unread", label: "Unread", icon: EnvelopeSimpleIcon },
 { key: "starred", label: "Starred", icon: StarIcon },
 { key: "hasAttachment", label: "Has attachment", icon: PaperclipIcon },
];

export function MailFilterBar({
 filters,
 onChange,
 view,
 className,
}: {
 filters: MailListFilters;
 onChange: (next: MailListFilters) => void;
 view: string;
 className?: string;
}) {
 const toggle = (key: FilterKey) => {
 onChange({ ...filters, [key]: !filters[key] || undefined });
 };

 const activeCount = Object.values(filters).filter(Boolean).length;

 const visible = FILTERS.filter(
 (f) => !(f.key === "starred" && view === "starred"),
 );

 return (
 <div className={cn("flex items-center gap-1 text-xs", className)}>
 {visible.map((f) => {
 const active = Boolean(filters[f.key]);
 const Icon = f.icon;
 return (
 <Button
 key={f.key}
 type="button"
 variant={"secondary"}
 size={"sm"}
 onClick={() => toggle(f.key)}
 className={cn("", active && "bg-muted")}
 >
 <Icon
 className="size-3"
 weight={active && f.key === "starred" ? "fill" : "regular"}
 />
 <span>{f.label}</span>
 </Button>
 );
 })}
 {activeCount > 0 && (
 <button
 type="button"
 onClick={() => onChange({})}
 className="inline-flex h-6 items-center gap-0.5 px-2 text-muted-foreground hover:text-foreground"
 >
 <XIcon className="size-3" />
 <span>Clear</span>
 </button>
 )}
 </div>
 );
}
