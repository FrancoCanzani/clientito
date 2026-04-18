import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

export function PageHeader({
  title,
  actions,
  isScrolled = false,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  isScrolled?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b px-4 transition-colors duration-300 sm:px-6",
        isScrolled ? "border-border/40 liquid-glass/10" : "border-transparent",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-lg tracking-[-0.6px] sm:tracking-[-0.8px] md:tracking-[-1px]">
          {title}
        </h1>
      </div>
      {actions && (
        <div className="flex flex-1 items-center justify-end gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
