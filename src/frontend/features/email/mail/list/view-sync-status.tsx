import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";

export function ViewSyncStatusControl({
 isBusy,
 needsReconnect,
 isRateLimited,
 onRefresh,
 disabled,
 className,
}: {
 isBusy: boolean;
 needsReconnect: boolean;
 isRateLimited: boolean;
 onRefresh: () => void;
 disabled?: boolean;
 className?: string;
}) {
 const title = needsReconnect
 ? "Reconnect this mailbox in Settings"
 : isRateLimited
 ? "Gmail is rate limiting — try again shortly"
 : isBusy
 ? "Refreshing"
 : "Refresh";

 return (
 <div className={cn("flex items-center", className)}>
 <Button
 type="button"
 variant="ghost"
 size="icon-sm"
 className="text-muted-foreground"
 onClick={onRefresh}
 disabled={disabled || isBusy || needsReconnect}
 title={title}
 aria-label="Refresh current view"
 >
 <ArrowClockwiseIcon
 className={cn("size-3.5", isBusy && "animate-spin duration-75")}
 />
 </Button>
 </div>
 );
}
