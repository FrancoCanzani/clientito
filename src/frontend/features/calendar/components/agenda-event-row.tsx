import { Button } from "@/components/ui/button";
import type { AgendaEvent } from "@/features/calendar/types";
import { CheckIcon, EnvelopeOpenIcon, MapPinIcon, PencilSimpleIcon, XIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function toLocalDatetimeValue(ms: number) {
  const d = new Date(ms);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function AgendaEventRow({
  event,
  onApprove,
  onDismiss,
  onEdit,
  isApproving,
}: {
  event: AgendaEvent;
  onApprove?: (proposedId: number) => void;
  onDismiss?: (proposedId: number) => void;
  onEdit?: (proposedId: number, data: { title?: string; location?: string; startAt?: number; endAt?: number }) => void;
  isApproving?: boolean;
}) {
  const isPending = event.status === "pending";
  const isPast = !event.isAllDay && event.endAt < Date.now();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const [editLocation, setEditLocation] = useState(event.location ?? "");
  const [editStart, setEditStart] = useState(toLocalDatetimeValue(event.startAt));
  const [editEnd, setEditEnd] = useState(toLocalDatetimeValue(event.endAt));

  const handleSave = () => {
    if (!event.proposedId || !onEdit) return;
    onEdit(event.proposedId, {
      title: editTitle,
      location: editLocation || undefined,
      startAt: new Date(editStart).getTime(),
      endAt: new Date(editEnd).getTime(),
    });
    setIsEditing(false);
  };

  if (isPending && isEditing) {
    return (
      <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/30 px-2 py-2">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Title"
        />
        <input
          type="text"
          value={editLocation}
          onChange={(e) => setEditLocation(e.target.value)}
          className="w-full bg-transparent text-xs text-muted-foreground outline-none"
          placeholder="Location"
        />
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={editStart}
            onChange={(e) => setEditStart(e.target.value)}
            className="bg-transparent text-xs text-muted-foreground outline-none"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="datetime-local"
            value={editEnd}
            onChange={(e) => setEditEnd(e.target.value)}
            className="bg-transparent text-xs text-muted-foreground outline-none"
          />
        </div>
        <div className="flex gap-1">
          <Button variant="default" size="sm" className="h-6 text-[11px]" onClick={handleSave}>
            Save
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-md px-2 py-1.5 ${
        isPending
          ? "border border-dashed border-border bg-muted/30"
          : "hover:bg-muted/40"
      } ${isPast ? "opacity-50" : ""}`}
    >
      <span className="w-24 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
        {event.isAllDay
          ? "All day"
          : `${timeFormat.format(new Date(event.startAt))} – ${timeFormat.format(new Date(event.endAt))}`}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-sm ${isPending ? "text-muted-foreground" : ""} ${isPast ? "line-through" : ""}`}>
          {event.title}
        </p>
        {event.location && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPinIcon className="size-3" />
            {event.location}
          </p>
        )}
        {isPending && event.description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
            {event.description}
          </p>
        )}
      </div>

      {isPending && event.proposedId != null && (
        <div className="flex shrink-0 items-center gap-0.5">
          {event.emailId && event.mailboxId && (
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" asChild>
              <Link
                to="/$mailboxId/inbox/email/$emailId"
                params={{
                  mailboxId: event.mailboxId,
                  emailId: String(event.emailId),
                }}
              >
                <EnvelopeOpenIcon className="size-3" />
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px]"
            onClick={() => setIsEditing(true)}
          >
            <PencilSimpleIcon className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px]"
            disabled={isApproving}
            onClick={() => onApprove?.(event.proposedId!)}
          >
            <CheckIcon className="mr-1 size-3" />
            {isApproving ? "Adding..." : "Approve"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px]"
            onClick={() => onDismiss?.(event.proposedId!)}
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
