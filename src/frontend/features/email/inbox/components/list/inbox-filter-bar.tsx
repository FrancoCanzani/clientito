import { cn } from "@/lib/utils";
import type { InboxListFilters } from "@/features/email/inbox/hooks/use-email-data";
import {
  EnvelopeSimpleIcon,
  PaperclipIcon,
  StarIcon,
  XIcon,
} from "@phosphor-icons/react";

type FilterKey = keyof InboxListFilters;

const FILTERS: {
  key: FilterKey;
  label: string;
  icon: typeof StarIcon;
}[] = [
  { key: "unread", label: "Unread", icon: EnvelopeSimpleIcon },
  { key: "starred", label: "Starred", icon: StarIcon },
  { key: "hasAttachment", label: "Has attachment", icon: PaperclipIcon },
];

export function InboxFilterBar({
  filters,
  onChange,
  view,
}: {
  filters: InboxListFilters;
  onChange: (next: InboxListFilters) => void;
  view: string;
}) {
  const toggle = (key: FilterKey) => {
    onChange({ ...filters, [key]: !filters[key] || undefined });
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  const visible = FILTERS.filter((f) => !(f.key === "starred" && view === "starred"));

  return (
    <div className="flex items-center gap-1 px-6 pb-1.5 text-xs">
      {visible.map((f) => {
        const active = Boolean(filters[f.key]);
        const Icon = f.icon;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => toggle(f.key)}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full border px-2 transition-colors",
              active
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-white/30 bg-background/50 text-muted-foreground backdrop-blur-md hover:text-foreground hover:border-foreground/30 dark:border-white/10 dark:bg-background/40",
            )}
          >
            <Icon
              className="size-3"
              weight={active && f.key === "starred" ? "fill" : "regular"}
            />
            <span>{f.label}</span>
          </button>
        );
      })}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3" />
          <span>Clear</span>
        </button>
      )}
    </div>
  );
}
