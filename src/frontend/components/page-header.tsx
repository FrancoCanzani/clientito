import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  isScrolled = false,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  isScrolled?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b px-3 transition-colors duration-300 md:px-6",
        isScrolled ? "border-border/40" : "border-transparent",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-lg tracking-[-0.6px] sm:tracking-[-0.8px] md:tracking-[-1px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions && (
        <div className="flex flex-1 items-center justify-end gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
