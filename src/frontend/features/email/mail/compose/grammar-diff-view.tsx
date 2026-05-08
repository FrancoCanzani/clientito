import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { diffWords } from "diff";
import { useMemo } from "react";

type GrammarDiffViewProps = {
 original: string;
 corrected: string;
 onAccept: () => void;
 onDiscard: () => void;
 className?: string;
 showActions?: boolean;
};

export function GrammarDiffView({
 original,
 corrected,
 onAccept,
 onDiscard,
 className,
 showActions = true,
}: GrammarDiffViewProps) {
 const parts = useMemo(
 () => diffWords(original, corrected),
 [original, corrected],
 );

 return (
 <div className={cn("flex flex-col", className)}>
 <div className="min-h-30 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed">
 {parts.map((part, i) => {
 if (part.added) {
 return (
 <span
 key={i}
 className="bg-green-500/15 text-green-700 dark:text-green-400"
 >
 {part.value}
 </span>
 );
 }
 if (part.removed) {
 return (
 <span
 key={i}
 className="bg-red-500/15 text-red-700 line-through dark:text-red-400"
 >
 {part.value}
 </span>
 );
 }
 return <span key={i}>{part.value}</span>;
 })}
 </div>
 {showActions && (
 <div className="flex items-center justify-end gap-1 border-t border-border/30 pt-2">
 <Button variant="ghost" size="sm" onClick={onDiscard}>
 <XIcon className="size-3.5" />
 Discard
 </Button>
 <Button variant="secondary" size="sm" onClick={onAccept}>
 <CheckIcon className="size-3.5" />
 Accept
 </Button>
 </div>
 )}
 </div>
 );
}
