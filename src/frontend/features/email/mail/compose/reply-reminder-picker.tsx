import { useState } from "react";
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from "@/components/ui/popover";
import { CheckIcon, BellSlashIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { REPLY_REMINDER_OPTIONS } from "./reply-reminder-options";

type ReplyReminderPickerProps = {
 value: number | null;
 onChange: (durationMs: number | null) => void;
 children: React.ReactNode;
};

export function ReplyReminderPicker({
 value,
 onChange,
 children,
}: ReplyReminderPickerProps) {
 const [open, setOpen] = useState(false);

 const handleSelect = (durationMs: number) => {
 onChange(durationMs);
 setOpen(false);
 };

 const handleClear = () => {
 onChange(null);
 setOpen(false);
 };

 return (
 <Popover open={open} onOpenChange={setOpen}>
 <PopoverTrigger asChild>{children}</PopoverTrigger>
 <PopoverContent align="end" className="w-auto p-0">
 <div className="flex flex-col gap-0.5 p-1">
 <div className="px-2 pt-1 pb-0.5 text-[11px] text-muted-foreground">
 Add to to-do if no reply in
 </div>
 {REPLY_REMINDER_OPTIONS.map((option) => {
 const selected = value === option.durationMs;
 return (
 <button
 key={option.id}
 type="button"
 className={cn(
 "flex min-h-7 w-full items-center justify-between gap-2 px-2 py-1 text-left text-xs/relaxed text-foreground outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground",
 )}
 onClick={() => handleSelect(option.durationMs)}
 >
 <span>{option.label}</span>
 {selected ? (
 <CheckIcon className="size-3.5 text-muted-foreground" />
 ) : null}
 </button>
 );
 })}
 {value != null ? (
 <>
 <div className="my-0.5 h-px bg-border" />
 <button
 type="button"
 className="flex min-h-7 w-full items-center gap-2 px-2 py-1 text-left text-xs/relaxed text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground"
 onClick={handleClear}
 >
 <BellSlashIcon className="size-3.5" />
 Don't remind
 </button>
 </>
 ) : null}
 </div>
 </PopoverContent>
 </Popover>
 );
}
