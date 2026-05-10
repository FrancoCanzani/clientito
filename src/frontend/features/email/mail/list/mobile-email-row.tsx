import { SnoozePicker } from "@/components/snooze-picker";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  PaperclipIcon,
  StarIcon,
  TrayIcon,
} from "@phosphor-icons/react";
import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { formatInboxRowDate } from "../utils/formatters";
import { useEmailRowModel, type EmailRowProps } from "./email-row-model";

const SWIPE_COMMIT_DISTANCE = 84;
const SWIPE_MAX_DISTANCE = 148;
const SWIPE_DRAG_RESISTANCE = 0.68;
const SWIPE_SETTLE_TRANSITION =
  "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)";

export const MobileEmailRow = memo(function MobileEmailRow({
  isFocused = false,
  isSelected = false,
  ...props
}: EmailRowProps) {
  const {
    threadCount,
    participantLabel,
    subject,
    snippet,
    handleMouseEnter,
    handleOpen,
    hasMetaIcons,
    isStarred,
    email,
  } = useEmailRowModel(props);

  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const latestOffsetRef = useRef(0);
  const swipingRef = useRef(false);
  const suppressOpenRef = useRef(false);
  const gestureDirectionRef = useRef<"horizontal" | "vertical" | null>(null);

  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const threadContext = useMemo(
    () =>
      props.group.threadId && email.mailboxId
        ? {
            threadId: props.group.threadId,
            mailboxId: email.mailboxId,
            labelIds: email.labelIds,
          }
        : undefined,
    [email.labelIds, email.mailboxId, props.group.threadId],
  );
  const ids = useMemo(
    () => props.group.emails.map((item) => item.id),
    [props.group.emails],
  );

  const isInInbox = email.labelIds.includes("INBOX");
  const isSpam = email.labelIds.includes("SPAM") || props.view === "spam";

  const primaryAction = isInInbox
    ? {
        action: "archive" as const,
        label: "Done",
        icon: CheckIcon,
      }
    : isSpam
      ? {
          action: "not-spam" as const,
          label: "Not spam",
          icon: TrayIcon,
        }
      : {
          action: "move-to-inbox" as const,
          label: "Inbox",
          icon: TrayIcon,
        };

  const readAction = email.isRead
    ? {
        action: "mark-unread" as const,
        label: "Unread",
        icon: EnvelopeSimpleIcon,
      }
    : {
        action: "mark-read" as const,
        label: "Read",
        icon: EnvelopeSimpleOpenIcon,
      };

  const closeSwipe = useCallback(() => {
    latestOffsetRef.current = 0;
    setOffset(0);
  }, []);

  const setSwipeOffset = useCallback((next: number) => {
    latestOffsetRef.current = next;
    setOffset(next);
  }, []);

  const triggerAction = useCallback(
    (
      action:
        | "archive"
        | "move-to-inbox"
        | "not-spam"
        | "mark-read"
        | "mark-unread",
    ) => {
      props.onAction(action, ids, threadContext);
      closeSwipe();
    },
    [closeSwipe, ids, props, threadContext],
  );

  const triggerSnooze = useCallback(
    (timestamp: number) => {
      props.onSnooze?.(props.group, timestamp);
      closeSwipe();
    },
    [closeSwipe, props],
  );

  const secondaryAction = props.onSnooze
    ? {
        action: "snooze" as const,
        label: "Snooze",
        icon: ClockIcon,
      }
    : readAction;
  const PrimaryIcon = primaryAction.icon;
  const SecondaryIcon = secondaryAction.icon;
  const swipeProgress = Math.min(1, Math.abs(offset) / SWIPE_COMMIT_DISTANCE);
  const reachedThreshold = Math.abs(offset) >= SWIPE_COMMIT_DISTANCE;
  const primaryStyle = getSwipeActionStyle(
    primaryAction.action,
    reachedThreshold,
  );
  const secondaryStyle = getSwipeActionStyle(
    secondaryAction.action,
    reachedThreshold,
  );
  const iconScale = 0.88 + swipeProgress * 0.18;

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    swipingRef.current = false;
    suppressOpenRef.current = false;
    gestureDirectionRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId) return;
      const dx = event.clientX - startXRef.current;
      const dy = event.clientY - startYRef.current;

      if (!gestureDirectionRef.current) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        gestureDirectionRef.current =
          Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }

      if (gestureDirectionRef.current !== "horizontal") return;

      if (!swipingRef.current) {
        swipingRef.current = true;
        suppressOpenRef.current = true;
        setIsDragging(true);
      }

      event.preventDefault();
      const clamped = Math.max(
        -SWIPE_MAX_DISTANCE,
        Math.min(SWIPE_MAX_DISTANCE, dx),
      );
      const nextOffset =
        Math.sign(clamped) *
        Math.min(SWIPE_MAX_DISTANCE, Math.abs(clamped) * SWIPE_DRAG_RESISTANCE);
      setSwipeOffset(nextOffset);
    },
    [setSwipeOffset],
  );

  const finalizeGesture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId) return;
      const finalOffset = latestOffsetRef.current;
      const didSwipe = swipingRef.current;
      setIsDragging(false);

      if (didSwipe && Math.abs(finalOffset) >= SWIPE_COMMIT_DISTANCE) {
        if (finalOffset > 0) {
          setSwipeOffset(SWIPE_MAX_DISTANCE);
          window.setTimeout(() => {
            triggerAction(primaryAction.action);
          }, 90);
        } else if (secondaryAction.action === "snooze") {
          closeSwipe();
          setSnoozeOpen(true);
        } else {
          setSwipeOffset(-SWIPE_MAX_DISTANCE);
          window.setTimeout(() => {
            triggerAction(secondaryAction.action);
          }, 90);
        }
      } else {
        closeSwipe();
      }

      if (didSwipe) {
        suppressOpenRef.current = true;
        window.setTimeout(() => {
          suppressOpenRef.current = false;
        }, 120);
      }
      swipingRef.current = false;
      pointerIdRef.current = null;
      gestureDirectionRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [
      closeSwipe,
      primaryAction.action,
      secondaryAction.action,
      setSwipeOffset,
      triggerAction,
    ],
  );

  const onRowClick = useCallback(() => {
    if (suppressOpenRef.current) return;
    if (latestOffsetRef.current !== 0) {
      closeSwipe();
      return;
    }
    handleOpen();
  }, [closeSwipe, handleOpen]);

  return (
    <div
      className={cn(
        "relative h-[88px] w-full overflow-hidden border-b border-border/40 bg-background",
        isFocused && "bg-muted",
        isSelected && "bg-muted",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex w-full items-center justify-start pl-6 transition-colors",
          primaryStyle.background,
          primaryStyle.foreground,
        )}
        style={{ opacity: offset > 0 ? Math.max(0.35, swipeProgress) : 0 }}
        aria-label={primaryAction.label}
      >
        <PrimaryIcon
          className="size-5 transition-transform"
          style={{ transform: `scale(${iconScale})` }}
        />
      </div>
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex w-full items-center justify-end pr-6 transition-colors",
          secondaryStyle.background,
          secondaryStyle.foreground,
        )}
        style={{ opacity: offset < 0 ? Math.max(0.35, swipeProgress) : 0 }}
        aria-label={secondaryAction.label}
      >
        <SecondaryIcon
          className="size-5 transition-transform"
          style={{ transform: `scale(${iconScale})` }}
        />
      </div>
      {props.onSnooze ? (
        <SnoozePicker
          open={snoozeOpen}
          onOpenChange={setSnoozeOpen}
          onSnooze={triggerSnooze}
        >
          <button
            type="button"
            tabIndex={-1}
            className="absolute top-1/2 right-3 size-1 -translate-y-1/2 opacity-0"
            aria-hidden
          />
        </SnoozePicker>
      ) : null}
      <div
        role="button"
        tabIndex={-1}
        className={cn(
          "relative z-10 flex h-full w-full cursor-default flex-col justify-center gap-1 bg-background px-3 py-2 text-left text-sm transition-transform hover:bg-muted",
          isFocused && "bg-muted",
          isSelected && "bg-muted",
        )}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? "none" : SWIPE_SETTLE_TRANSITION,
          touchAction: "pan-y",
        }}
        onMouseEnter={handleMouseEnter}
        onFocus={handleMouseEnter}
        onClick={onRowClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finalizeGesture}
        onPointerCancel={finalizeGesture}
      >
        <div className="flex w-full min-w-0 items-center gap-1.5">
          {!email.isRead && <span className="sr-only">Unread.</span>}
          <span
            className={cn(
              "min-w-0 truncate text-sm font-medium text-foreground",
              !email.isRead && "font-semibold",
            )}
          >
            {participantLabel}
          </span>
          {!email.isRead && (
            <span className="size-1.5 shrink-0 bg-primary" aria-hidden />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            {hasMetaIcons && (
              <div className="flex shrink-0 items-center gap-1">
                {isStarred && (
                  <StarIcon
                    className="size-3 text-yellow-400"
                    weight="fill"
                    aria-hidden
                  />
                )}
                {email.hasCalendar && (
                  <CalendarIcon className="size-3" aria-hidden />
                )}
                {email.hasAttachment && (
                  <PaperclipIcon className="size-3" aria-hidden />
                )}
              </div>
            )}
            {threadCount > 1 && (
              <span className="text-[11px] tabular-nums">[{threadCount}]</span>
            )}
            <span className="whitespace-nowrap font-mono text-[10px] tracking-tighter tabular-nums">
              {formatInboxRowDate(email.date)}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "w-full truncate text-xs leading-4",
            !email.isRead && "font-medium text-foreground",
          )}
        >
          {subject}
        </div>

        {snippet && (
          <div className="line-clamp-2 w-full min-w-0 overflow-hidden text-xs leading-4 text-muted-foreground">
            {snippet}
          </div>
        )}
      </div>
    </div>
  );
});

function getSwipeActionStyle(
  action:
    | "archive"
    | "move-to-inbox"
    | "not-spam"
    | "mark-read"
    | "mark-unread"
    | "snooze",
  active: boolean,
) {
  switch (action) {
    case "archive":
      return {
        background: active ? "bg-emerald-500/20" : "bg-emerald-500/10",
        foreground: "text-black dark:text-white",
      };
    case "move-to-inbox":
      return {
        background: active ? "bg-blue-500/20" : "bg-blue-500/10",
        foreground: "text-black dark:text-white",
      };
    case "not-spam":
      return {
        background: active ? "bg-violet-500/20" : "bg-violet-500/10",
        foreground: "text-black dark:text-white",
      };
    case "snooze":
      return {
        background: active ? "bg-amber-500/20" : "bg-amber-500/10",
        foreground: "text-black dark:text-white",
      };
    case "mark-read":
    case "mark-unread":
      return {
        background: active ? "bg-sky-500/20" : "bg-sky-500/10",
        foreground: "text-black dark:text-white",
      };
  }
}
