import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

export function PageHeader({
  title,
  actions,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 border-b border-border/50 z-20 flex min-h-14 shrink-0 items-center justify-between gap-3 bg-background px-3 transition-colors duration-200",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-xl tracking-[-0.6px] sm:tracking-[-0.8px] md:tracking-[-1px] text-foreground">
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
