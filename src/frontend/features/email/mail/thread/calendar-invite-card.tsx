import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { Button } from "@/components/ui/button";
import { respondToCalendarInvite } from "@/features/email/mail/mutations";
import { fetchCalendarInvitePreview } from "@/features/email/mail/queries";
import type {
  CalendarInvitePreview,
  CalendarInviteResponseStatus,
  EmailDetailItem,
} from "@/features/email/mail/types";
import { CalendarIcon, MapPinIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function isCancelledInvite(invite: CalendarInvitePreview): boolean {
  return (
    invite.method?.toUpperCase() === "CANCEL" ||
    invite.status?.toUpperCase() === "CANCELLED"
  );
}

function formatInviteDate(invite: CalendarInvitePreview): string {
  if (invite.startMs == null) return "Time unavailable";

  const startText = new Date(invite.startMs).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (invite.endMs == null) {
    return startText;
  }

  const endText = new Date(invite.endMs).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${startText} - ${endText}`;
}

function formatStatus(status: CalendarInviteResponseStatus | null): string | null {
  if (!status) return null;
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "tentative") return "Tentative";
  return "Awaiting reply";
}

export function CalendarInviteCard({ email }: { email: EmailDetailItem }) {
  const queryClient = useQueryClient();
  const mailboxId = email.mailboxId;
  const enabled = email.hasCalendar && mailboxId != null;

  const queryKey =
    mailboxId == null
      ? (["calendar-invite-preview", "none", email.providerMessageId] as const)
      : emailQueryKeys.calendarInvitePreview(mailboxId, email.providerMessageId);

  const previewQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchCalendarInvitePreview({
        mailboxId: mailboxId!,
        providerMessageId: email.providerMessageId,
      }),
    enabled,
    staleTime: 5 * 60_000,
  });

  const invite = previewQuery.data;

  const respondMutation = useMutation({
    mutationFn: (response: "accepted" | "declined") =>
      respondToCalendarInvite({
        mailboxId: mailboxId!,
        inviteUid: invite!.uid,
        response,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData<CalendarInvitePreview | null>(
        queryKey,
        (current) => {
          if (!current) return current;
          return {
            ...current,
            selfResponseStatus:
              result.selfResponseStatus ?? result.responseStatus,
          };
        },
      );

      toast.success(
        result.responseStatus === "accepted" ? "Invite accepted" : "Invite declined",
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update calendar response",
      );
    },
  });

  if (!enabled) return null;
  if (previewQuery.isPending || !invite) return null;

  const cancelled = isCancelledInvite(invite);
  const responseStatus = formatStatus(invite.selfResponseStatus);

  return (
    <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <CalendarIcon className="mt-0.5 size-3.5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {invite.title?.trim() || "Calendar invite"}
          </p>
          <p className="text-xs text-muted-foreground">{formatInviteDate(invite)}</p>
          {invite.location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon className="size-3" />
              <span className="truncate">{invite.location}</span>
            </p>
          )}
          {cancelled ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              This event was canceled
            </p>
          ) : responseStatus && (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Status: {responseStatus}
            </p>
          )}
        </div>
      </div>

      {!cancelled && (
        <div className="mt-2 flex items-center gap-1.5">
          <Button
            size="sm"
            variant={invite.selfResponseStatus === "accepted" ? "default" : "secondary"}
            disabled={respondMutation.isPending}
            onClick={() => respondMutation.mutate("accepted")}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant={invite.selfResponseStatus === "declined" ? "destructive" : "outline"}
            disabled={respondMutation.isPending}
            onClick={() => respondMutation.mutate("declined")}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
