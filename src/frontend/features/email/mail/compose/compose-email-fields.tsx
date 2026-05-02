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
import { useHotkeys } from "@/hooks/use-hotkeys";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ClockIcon,
  FilesIcon,
  PaperclipIcon,
  SignatureIcon,
  SparkleIcon,
  SpinnerGapIcon,
  TextAaIcon,
  XIcon,
} from "@phosphor-icons/react";
import DOMPurify from "dompurify";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ComposeDockedToolbar } from "./compose-docked-toolbar";
import { GrammarDiffView } from "./grammar-diff-view";
import { RecipientInput } from "./recipient-input";
import { ScheduleSendPicker } from "./schedule-send-picker";

type ComposeEmailFieldsProps = {
  compose: ReturnType<typeof useComposeEmail>;
  bodyClassName?: string;
  onEscape?: () => void;
  onDiscard?: () => void;
  recipientAutoFocus?: boolean;
  editorAutoFocus?: boolean;
  showMailboxSelector?: boolean;
};

type ComposeFocusedField = "to" | "cc" | "bcc" | "subject" | "body";

function getInitialFocusedField({
  recipientAutoFocus,
  editorAutoFocus,
}: {
  recipientAutoFocus: boolean;
  editorAutoFocus: boolean;
}): ComposeFocusedField | null {
  if (recipientAutoFocus) return "to";
  if (editorAutoFocus) return "body";
  return null;
}

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
        aria-expanded={expanded}
        aria-label={expanded ? "Hide forwarded message" : "Show forwarded message"}
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
  onDiscard,
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
    signatures,
    selectedSignatureId,
    applySignatureById,
    templates,
    applyTemplateById,
  } = compose;

  const [showCc, setShowCc] = useState(cc.length > 0);
  const [showBcc, setShowBcc] = useState(bcc.length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const hasBody =
    body.trim().length > 0 && body !== "<p></p>" && body !== "<p><br></p>";
  const aiEnabledForMailbox =
    availableMailboxes.find((m) => m.mailboxId === mailboxId)?.aiEnabled ?? true;
  const [focusedField, setFocusedField] = useState<ComposeFocusedField | null>(
    () =>
      getInitialFocusedField({
        recipientAutoFocus,
        editorAutoFocus,
      }),
  );
  const [reviewState, setReviewState] = useState<
    | { status: "idle" }
    | { status: "loading"; action: ComposerAiActionId }
    | { status: "reviewing"; review: ComposerAiReview }
  >({ status: "idle" });
  const [bodyEditor, setBodyEditor] = useState<TiptapEditor | null>(null);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const isReviewing = reviewState.status === "reviewing";
  const pendingAiAction =
    reviewState.status === "loading" ? reviewState.action : null;

  const handleComposerAiAction = async (action: ComposerAiActionId) => {
    setReviewState({ status: "loading", action });
    try {
      const review = await previewComposerAiAction(action, mailboxId);
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
    } catch (error) {
      console.warn("Compose AI action failed", error);
      toast.error("AI action failed");
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

  useEffect(() => {
    if (recipientAutoFocus) {
      setFocusedField("to");
      return;
    }
    if (editorAutoFocus) {
      setFocusedField("body");
    }
  }, [editorAutoFocus, recipientAutoFocus]);

  useEffect(() => {
    if (focusedField === "subject") {
      subjectInputRef.current?.focus();
    }
  }, [focusedField]);

  useHotkeys(
    {
      o: {
        onKeyDown: () => setFocusedField("to"),
      },
      c: {
        onKeyDown: () => {
          setShowCc(true);
          setFocusedField("cc");
        },
      },
      b: {
        onKeyDown: () => {
          setShowBcc(true);
          setFocusedField("bcc");
        },
      },
      s: {
        onKeyDown: () => setFocusedField("subject"),
      },
      m: {
        onKeyDown: () => setFocusedField("body"),
      },
    },
    { target: rootRef.current },
  );

  return (
    <div
      ref={rootRef}
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
            isFocused={focusedField === "to"}
            onFocusField={() => setFocusedField("to")}
            onAdvanceFocus={() => {
              if (showCc) {
                setFocusedField("cc");
                return;
              }
              if (showBcc) {
                setFocusedField("bcc");
                return;
              }
              setFocusedField("subject");
            }}
          />
          <div className="flex items-center gap-2 pt-1">
            {!showCc && (
              <button
                type="button"
                aria-label="Add Cc recipients"
                className="text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
                onClick={() => {
                  setShowCc(true);
                  setFocusedField("cc");
                }}
              >
                Cc
              </button>
            )}
            {!showBcc && (
              <button
                type="button"
                aria-label="Add Bcc recipients"
                className="text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
                onClick={() => {
                  setShowBcc(true);
                  setFocusedField("bcc");
                }}
              >
                Bcc
              </button>
            )}
          </div>
        </div>

        {showCc && (
          <div className="flex items-start gap-2 px-2 py-1">
            <RecipientInput
              value={cc}
              onChange={setCc}
              placeholder="Cc"
              isFocused={focusedField === "cc"}
              onFocusField={() => setFocusedField("cc")}
              onAdvanceFocus={() => {
                if (showBcc) {
                  setFocusedField("bcc");
                  return;
                }
                setFocusedField("subject");
              }}
            />
            <button
              type="button"
              aria-label="Remove Cc field"
              className="shrink-0 pt-1 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
              onClick={() => {
                setCc("");
                setShowCc(false);
                if (focusedField === "cc") {
                  setFocusedField("to");
                }
              }}
            >
              &times;
            </button>
          </div>
        )}

        {showBcc && (
          <div className="flex items-start gap-2 px-2 py-1">
            <RecipientInput
              value={bcc}
              onChange={setBcc}
              placeholder="Bcc"
              isFocused={focusedField === "bcc"}
              onFocusField={() => setFocusedField("bcc")}
              onAdvanceFocus={() => setFocusedField("subject")}
            />
            <button
              type="button"
              aria-label="Remove Bcc field"
              className="shrink-0 pt-1 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
              onClick={() => {
                setBcc("");
                setShowBcc(false);
                if (focusedField === "bcc") {
                  setFocusedField(showCc ? "cc" : "to");
                }
              }}
            >
              &times;
            </button>
          </div>
        )}

        <input
          ref={subjectInputRef}
          placeholder="Subject"
          aria-label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onFocus={() => setFocusedField("subject")}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setFocusedField("body");
            }
          }}
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
            isFocused={focusedField === "body"}
            onFocusField={() => setFocusedField("body")}
            onEditorReady={setBodyEditor}
          />
          {forwardedContent && (
            <ForwardedMessagePreview html={forwardedContent} />
          )}
        </div>
      </div>

      <div className="mt-auto px-2 py-2">
        {!isReviewing && showFormatToolbar && (
          <ComposeDockedToolbar editor={bodyEditor} />
        )}
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
              aria-label="Attach files"
            >
              <PaperclipIcon className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={isReviewing}
              onClick={() => setShowFormatToolbar((v) => !v)}
              title={
                showFormatToolbar
                  ? "Hide formatting options"
                  : "Show formatting options"
              }
              aria-label={
                showFormatToolbar
                  ? "Hide formatting options"
                  : "Show formatting options"
              }
              aria-pressed={showFormatToolbar}
              className={cn(showFormatToolbar && "bg-muted")}
            >
              <TextAaIcon className="size-3" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isReviewing}
                  className="h-7 w-7"
                  title="Signatures"
                  aria-label="Signatures"
                >
                  <SignatureIcon className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {signatures.length === 0 ? (
                  <DropdownMenuItem disabled className="justify-start text-left">
                    <span className="min-w-0 truncate text-left">
                      No saved signatures
                    </span>
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onSelect={() => applySignatureById(null)}>
                      {selectedSignatureId == null ? (
                        <CheckIcon className="size-3" />
                      ) : (
                        <span className="size-3" />
                      )}
                      No signature
                    </DropdownMenuItem>
                    {signatures.map((signature) => (
                      <DropdownMenuItem
                        key={signature.id}
                        onSelect={() => applySignatureById(signature.id)}
                      >
                        {selectedSignatureId === signature.id ? (
                          <CheckIcon className="size-3" />
                        ) : (
                          <span className="size-3" />
                        )}
                        <span className="min-w-0 truncate">{signature.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isReviewing}
                  className="h-7 w-7"
                  title="Templates"
                  aria-label="Templates"
                >
                  <FilesIcon className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {templates.length === 0 ? (
                  <DropdownMenuItem disabled className="justify-start text-left">
                    <span className="min-w-0 truncate text-left">
                      No saved templates
                    </span>
                  </DropdownMenuItem>
                ) : (
                  templates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      onSelect={() => applyTemplateById(template.id)}
                    >
                      <span className="size-3" />
                      <span className="min-w-0 truncate">{template.name}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {isReviewing ? (
              <>
                <Button
                  variant="destructive"
                  size="icon-xs"
                  onClick={handleDiscardReview}
                  title="Discard AI changes"
                  aria-label="Discard AI changes"
                >
                  <XIcon className="size-3" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon-xs"
                  onClick={handleAcceptReview}
                  title="Apply AI changes"
                  aria-label="Apply AI changes"
                >
                  <CheckIcon className="size-3" />
                </Button>
              </>
            ) : !aiEnabledForMailbox ? null : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pendingAiAction !== null || !hasBody}
                    title="AI writing tools"
                    aria-label="AI writing tools"
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

            <ScheduleSendPicker
              onSchedule={(timestamp) => {
                scheduleSend(timestamp);
              }}
            >
              <Button
                variant="ghost"
                size="icon"
                disabled={!canSend || isReviewing}
                aria-label="Schedule send"
              >
                <ClockIcon className="size-3" />
              </Button>
            </ScheduleSendPicker>
          </div>
          <div className="flex items-center gap-2">
            {onDiscard && (
              <Button
                variant="destructive"
                onClick={onDiscard}
                disabled={isPending}
              >
                Discard
              </Button>
            )}
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
    </div>
  );
}
