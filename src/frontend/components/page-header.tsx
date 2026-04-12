import { cn } from "@/lib/utils";
import { type ReactNode, useEffect, useRef, useState } from "react";

export function PageHeader({
  title,
  actions,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry!.isIntersecting),
      { threshold: 1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={ref}
      className={cn(
        "sticky top-0 z-20 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-0 transition-colors duration-200",
        scrolled ? "border-border" : "border-transparent",
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
