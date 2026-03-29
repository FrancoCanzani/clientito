import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
        <h1 className="truncate text-xl font-medium">{title}</h1>
      </div>
      {actions ? (
        <div className="flex items-center justify-end gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
