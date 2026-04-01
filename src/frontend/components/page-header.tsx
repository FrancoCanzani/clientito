import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

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
        "sticky top-0 z-20 flex items-center justify-between gap-3 bg-background pb-2 pt-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-xl font-medium tracking-[-0.6px] sm:tracking-[-0.8px] md:tracking-[-1px] text-foreground">
          {title}
        </h1>
      </div>
      {actions ? (
        <div className="flex items-center justify-end gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
