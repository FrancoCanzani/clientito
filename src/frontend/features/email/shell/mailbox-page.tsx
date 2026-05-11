import { PageContainer } from "@/components/page-container";
import { cn } from "@/lib/utils";
import { useContext, useRef, useState, type ReactNode } from "react";
import {
  MailboxScrolledContext,
  MailboxSetScrolledContext,
  useMailboxPageScrollState,
} from "./mailbox-scroll-state";

export function MailboxPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [isScrolled, setIsScrolled] = useState(false);

  return (
    <MailboxSetScrolledContext.Provider value={setIsScrolled}>
      <MailboxScrolledContext.Provider value={isScrolled}>
        <PageContainer className={className}>{children}</PageContainer>
      </MailboxScrolledContext.Provider>
    </MailboxSetScrolledContext.Provider>
  );
}

export function MailboxPageHeader({
  title,
  actions,
  isScrolled: isScrolledProp,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  isScrolled?: boolean;
  className?: string;
}) {
  const contextIsScrolled = useContext(MailboxScrolledContext);
  const isScrolled = isScrolledProp ?? contextIsScrolled;

  return (
    <header
      className={cn(
        "flex min-h-10 shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-1.5 md:px-4",
        isScrolled ? "border-border/40" : "border-transparent",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1 className="shrink-0 truncate">{title}</h1>
      </div>
      {actions && (
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
          {actions}
        </div>
      )}
    </header>
  );
}

export function MailboxPageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useMailboxPageScrollState(scrollRef);

  return (
    <div
      ref={scrollRef}
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      {children}
    </div>
  );
}
