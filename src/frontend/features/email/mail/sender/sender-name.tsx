import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import * as React from "react";
import { SenderHoverCard } from "@/features/email/mail/sender/sender-hover-card";

export function SenderName({
  email,
  name,
  className,
  children,
  showHoverCard = true,
}: {
  email: string | null | undefined;
  name?: string | null;
  className?: string;
  children?: React.ReactNode;
  showHoverCard?: boolean;
}) {
  const normalized = (email ?? "").trim();
  const label = children ?? (name?.trim() || normalized);

  if (!normalized || !showHoverCard) {
    return <span className={className}>{label}</span>;
  }

  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className={cn("cursor-default", className)}>{label}</span>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-80"
        side="bottom"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <SenderHoverCard email={normalized} fallbackName={name} />
      </HoverCardContent>
    </HoverCard>
  );
}
