import { useState } from "react";
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
 ClockIcon,
 SunIcon,
 CalendarIcon,
 CalendarDotsIcon,
} from "@phosphor-icons/react";

type SnoozePickerProps = {
 onSnooze: (timestamp: number) => void;
 children: React.ReactNode;
};

function getLaterToday(): number {
 return Date.now() + 3 * 60 * 60 * 1000;
}

function getTomorrowMorning(): number {
 const d = new Date();
 d.setDate(d.getDate() + 1);
 d.setHours(9, 0, 0, 0);
 return d.getTime();
}

function getNextMondayMorning(): number {
 const d = new Date();
 const dayOfWeek = d.getDay();
 const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
 d.setDate(d.getDate() + daysUntilMonday);
 d.setHours(9, 0, 0, 0);
 return d.getTime();
}

export function SnoozePicker({ onSnooze, children }: SnoozePickerProps) {
 const [open, setOpen] = useState(false);
 const [showCustom, setShowCustom] = useState(false);
 const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
 const [time, setTime] = useState("09:00");

 const handlePreset = (timestamp: number) => {
 onSnooze(timestamp);
 setOpen(false);
 setShowCustom(false);
 };

 const handleCustomConfirm = () => {
 if (!selectedDate) return;
 const [hours, minutes] = time.split(":").map(Number);
 const d = new Date(selectedDate);
 d.setHours(hours, minutes, 0, 0);
 if (d.getTime() <= Date.now()) return;
 onSnooze(d.getTime());
 setOpen(false);
 setShowCustom(false);
 };

 return (
 <Popover
 open={open}
 onOpenChange={(next) => {
 setOpen(next);
 if (!next) setShowCustom(false);
 }}
 >
 <PopoverTrigger asChild>{children}</PopoverTrigger>
 <PopoverContent align="end" className="w-auto p-0">
 {!showCustom ? (
 <div className="flex flex-col gap-0.5 p-1">
 <button
 type="button"
 className="flex min-h-7 w-full items-center gap-2 px-2 py-1 text-left text-xs/relaxed text-foreground outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground"
 onClick={() => handlePreset(getLaterToday())}
 >
 <ClockIcon className="size-3.5 text-muted-foreground" />
 Later today
 </button>
 <button
 type="button"
 className="flex min-h-7 w-full items-center gap-2 px-2 py-1 text-left text-xs/relaxed text-foreground outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground"
 onClick={() => handlePreset(getTomorrowMorning())}
 >
 <SunIcon className="size-3.5 text-muted-foreground" />
 Tomorrow morning
 </button>
 <button
 type="button"
 className="flex min-h-7 w-full items-center gap-2 px-2 py-1 text-left text-xs/relaxed text-foreground outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground"
 onClick={() => handlePreset(getNextMondayMorning())}
 >
 <CalendarIcon className="size-3.5 text-muted-foreground" />
 Next week
 </button>
 <button
 type="button"
 className="flex min-h-7 w-full items-center gap-2 px-2 py-1 text-left text-xs/relaxed text-foreground outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground"
 onClick={() => setShowCustom(true)}
 >
 <CalendarDotsIcon className="size-3.5 text-muted-foreground" />
 Pick date & time
 </button>
 </div>
 ) : (
 <div className="flex flex-col gap-2 p-2">
 <Calendar
 mode="single"
 selected={selectedDate}
 onSelect={setSelectedDate}
 disabled={{ before: new Date() }}
 />
 <div className="flex items-center gap-2 px-1">
 <label htmlFor="snooze-time" className="text-xs text-muted-foreground">
 Time
 </label>
 <Input
 id="snooze-time"
 type="time"
 value={time}
 onChange={(e) => setTime(e.target.value)}
 className="h-8 w-auto flex-1 text-sm"
 />
 </div>
 <div className="flex justify-end gap-2 px-1 pt-1">
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setShowCustom(false)}
 >
 Back
 </Button>
 <Button
 size="sm"
 onClick={handleCustomConfirm}
 disabled={!selectedDate}
 >
 Snooze
 </Button>
 </div>
 </div>
 )}
 </PopoverContent>
 </Popover>
 );
}
