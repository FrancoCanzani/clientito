import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMailboxDisplayEmail } from "@/hooks/use-mailboxes";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ClockIcon,
  PaperclipIcon,
  SparkleIcon,
  SpinnerGapIcon,
  XIcon,
} from "@phosphor-icons/react";
import DOMPurify from "dompurify";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AttachmentBar } from "./attachment-bar";
import {
  applyComposerAiReview,
  COMPOSER_AI_ACTIONS,
  getComposerAiLabel,
  previewComposerAiAction,
  type ComposerAiActionId,
  type ComposerAiReview,
} from "./compose-ai-actions";
import { ComposeEditor } from "./compose-editor";
import { useComposeEmail } from "./compose-email-state";
import { GrammarDiffView } from "./grammar-diff-view";
import { RecipientInput } from "./recipient-input";
import { ScheduleSendPicker } from "./schedule-send-picker";

type ComposeEmailFieldsProps = {
  compose: ReturnType<typeof useComposeEmail>;
  bodyClassName?: string;
  onEscape?: () => void;
  recipientAutoFocus?: boolean;
  editorAutoFocus?: boolean;
  showMailboxSelector?: boolean;
};

function ForwardedMessagePreview({ html }: { html: string }) {
  const [expanded, setExpanded] = useState(false);
  const sanitized = useMemo(
    () =>
      DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
      }),
    [html],
  );

  return (
    <div className="mt-4 pt-2">
      <button
        type="button"
        className="flex h-5 items-center rounded bg-muted px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={() => setExpanded((v) => !v)}
      >
        &hellip;
      </button>
      {expanded && (
        <div
          className={cn(
            "prose prose-sm max-w-none pt-3 text-xs text-foreground",
            "[&_[data-forwarded-message]]:mt-0 [&_[data-forwarded-message]]:border-0 [&_[data-forwarded-message]]:p-0",
            "[&_[data-forwarded-header]]:mb-2 [&_[data-forwarded-header]]:font-medium [&_[data-forwarded-header]]:text-foreground/80",
            "[&_[data-forwarded-original-body]]:mt-3 [&_[data-forwarded-original-body]]:border-t [&_[data-forwarded-original-body]]:border-border/40 [&_[data-forwarded-original-body]]:pt-3",
          )}
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )}
    </div>
  );
}

export function ComposeEmailFields({
  compose,
  bodyClassName,
  onEscape,
  recipientAutoFocus = false,
  editorAutoFocus = false,
  showMailboxSelector = true,
}: ComposeEmailFieldsProps) {
  const {
    to,
    setTo,
    mailboxId,
    setMailboxId,
    cc,
    setCc,
    bcc,
    setBcc,
    subject,
    setSubject,
    body,
    setBody,
    forwardedContent,
    canSend,
    availableMailboxes,
    send,
    scheduleSend,
    isPending,
    attachments,
  } = compose;

  const [showCc, setShowCc] = useState(cc.length > 0);
  const [showBcc, setShowBcc] = useState(bcc.length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasBody =
    body.trim().length > 0 && body !== "<p></p>" && body !== "<p><br></p>";
  const [reviewState, setReviewState] = useState<
    | { status: "idle" }
    | { status: "loading"; action: ComposerAiActionId }
    | { status: "reviewing"; review: ComposerAiReview }
  >({ status: "idle" });
  const isReviewing = reviewState.status === "reviewing";
  const pendingAiAction =
    reviewState.status === "loading" ? reviewState.action : null;

  const handleComposerAiAction = async (action: ComposerAiActionId) => {
    setReviewState({ status: "loading", action });
    try {
      const review = await previewComposerAiAction(action);
      if (review === "no_changes") {
        toast.info("No changes suggested");
        setReviewState({ status: "idle" });
        return;
      }
      if (!review) {
        setReviewState({ status: "idle" });
        return;
      }
      setReviewState({ status: "reviewing", review });
    } catch {
      setReviewState({ status: "idle" });
    }
  };

  const handleAcceptReview = () => {
    if (reviewState.status !== "reviewing") return;
    const applied = applyComposerAiReview(reviewState.review);
    if (applied) {
      setReviewState({ status: "idle" });
    }
  };

  const handleDiscardReview = () => {
    setReviewState({ status: "idle" });
  };

  return (
    <div
      role="group"
      aria-label="Compose email"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          if (isReviewing) {
            handleDiscardReview();
          } else {
            onEscape?.();
          }
        }
      }}
    >
      <div className="space-y-2 px-1 py-2 border-b border-border/40">
        {showMailboxSelector && availableMailboxes.length > 1 && (
          <Select
            value={mailboxId != null ? String(mailboxId) : undefined}
            onValueChange={(value) => setMailboxId(Number(value))}
          >
            <SelectTrigger
              className="h-auto w-full border-0 px-3 text-left text-xs text-muted-foreground shadow-none focus-visible:ring-0"
              size="default"
            >
              <SelectValue placeholder="Select sender" />
            </SelectTrigger>
            <SelectContent align="start">
              {availableMailboxes.map((mailbox) => (
                <SelectItem
                  key={mailbox.mailboxId}
                  value={String(mailbox.mailboxId)}
                >
                  {getMailboxDisplayEmail(mailbox) ?? "Unknown account"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-start gap-2 px-2 py-1">
          <RecipientInput
            value={to}
            onChange={setTo}
            autoFocus={recipientAutoFocus}
          />
          <div className="flex items-center gap-2 pt-1">
            {!showCc && (
              <button
                type="button"
                className="text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
                onClick={() => setShowCc(true)}
              >
                Cc
              </button>
            )}
            {!showBcc && (
              <button
                type="button"
                className="text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
                onClick={() => setShowBcc(true)}
              >
                Bcc
              </button>
            )}
          </div>
        </div>

        {showCc && (
          <div className="flex items-start gap-2 px-2 py-1">
            <RecipientInput value={cc} onChange={setCc} placeholder="Cc" />
            <button
              type="button"
              className="shrink-0 pt-1 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
              onClick={() => {
                setCc("");
                setShowCc(false);
              }}
            >
              &times;
            </button>
          </div>
        )}

        {showBcc && (
          <div className="flex items-start gap-2 px-2 py-1">
            <RecipientInput value={bcc} onChange={setBcc} placeholder="Bcc" />
            <button
              type="button"
              className="shrink-0 pt-1 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
              onClick={() => {
                setBcc("");
                setShowBcc(false);
              }}
            >
              &times;
            </button>
          </div>
        )}

        <input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full bg-transparent py-1 px-2 text-xs outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        {reviewState.status === "reviewing" && (
          <GrammarDiffView
            original={reviewState.review.original}
            corrected={reviewState.review.corrected}
            onAccept={handleAcceptReview}
            onDiscard={handleDiscardReview}
            showActions={false}
            className={bodyClassName ?? "min-h-32 text-sm leading-relaxed"}
          />
        )}
        <div className={cn(reviewState.status === "reviewing" && "hidden")}>
          <ComposeEditor
            initialContent={body}
            onChange={setBody}
            onSend={() => {
              if (canSend) send();
            }}
            className={bodyClassName ?? "min-h-32 text-sm leading-relaxed"}
            autoFocus={editorAutoFocus}
          />
          {forwardedContent && (
            <ForwardedMessagePreview html={forwardedContent} />
          )}
        </div>
      </div>

      <div className="mt-auto px-2 py-2">
        <AttachmentBar
          files={attachments.files}
          uploading={attachments.uploading}
          onAddFiles={(files) => attachments.addFiles(files)}
          onRemoveFile={attachments.removeFile}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              attachments.addFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={attachments.uploading || isReviewing}
              onClick={() => fileInputRef.current?.click()}
              title="Attach files"
            >
              <PaperclipIcon className="size-3" />
            </Button>
            {isReviewing ? (
              <>
                <Button
                  variant="destructive"
                  size="icon-xs"
                  onClick={handleDiscardReview}
                  title="Discard AI changes"
                >
                  <XIcon className="size-3" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon-xs"
                  onClick={handleAcceptReview}
                  title="Apply AI changes"
                >
                  <CheckIcon className="size-3" />
                </Button>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pendingAiAction !== null || !hasBody}
                    title="AI writing tools"
                  >
                    {pendingAiAction ? (
                      <SpinnerGapIcon className="size-3 animate-spin" />
                    ) : (
                      <SparkleIcon className="size-3" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  {COMPOSER_AI_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    const isPending = pendingAiAction === action.id;

                    return (
                      <DropdownMenuItem
                        key={action.id}
                        disabled={pendingAiAction !== null}
                        onSelect={() => {
                          void handleComposerAiAction(action.id);
                        }}
                      >
                        {isPending ? (
                          <SpinnerGapIcon className="size-3 animate-spin" />
                        ) : (
                          <Icon className="size-3" />
                        )}
                        {getComposerAiLabel(action.id)}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="ghost"
              size="icon"
              disabled={pendingAiAction !== null || !hasBody || isReviewing}
              onClick={() => {
                void handleComposerAiAction("grammar");
              }}
              title="Grammar check"
            >
              {pendingAiAction === "grammar" ? (
                <SpinnerGapIcon className="size-3 animate-spin" />
              ) : (
                <CheckIcon className="size-3" />
              )}
            </Button>
            <ScheduleSendPicker
              onSchedule={(timestamp) => {
                scheduleSend(timestamp);
              }}
            >
              <Button
                variant="ghost"
                size="icon"
                disabled={!canSend || isReviewing}
              >
                <ClockIcon className="size-3" />
              </Button>
            </ScheduleSendPicker>
          </div>
          <Button
            variant="secondary"
            onClick={() => send()}
            disabled={!canSend || isPending || isReviewing}
          >
            {isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
