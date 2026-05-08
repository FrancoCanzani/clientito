import { cn } from "@/lib/utils";
import { SpinnerGapIcon } from "@phosphor-icons/react";

export function PageSpinner({
 label,
 className,
}: {
 label?: string;
 className?: string;
}) {
 return (
 <div
 className={cn(
 "flex h-full w-full flex-col items-center justify-center gap-3 py-16 text-muted-foreground",
 className,
 )}
 >
 <SpinnerGapIcon className="size-4 animate-spin" />
 {label && <span className="text-xs">{label}</span>}
 </div>
 );
}
