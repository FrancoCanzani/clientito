import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createTask } from "@/features/customers/api";
import {
  CheckIcon,
  CircleNotchIcon,
  DownloadSimpleIcon,
  ImageIcon,
  PaperclipIcon,
  SparkleIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import {
  analyzeEmail,
  fetchEmailDetail,
  markAsCustomer,
  type EmailAnalysis,
  type EmailAttachment,
  type EmailListItem,
} from "../api";

function formatBytes(size: number | null): string {
  if (!size || size <= 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const decimals = value >= 10 || index === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[index]}`;
}

function AttachmentItem({ attachment }: { attachment: EmailAttachment }) {
  return (
    <a
      href={attachment.downloadUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between gap-3 rounded-md bg-card/30 px-3 py-2 text-xs hover:bg-accent/40"
    >
      <div className="min-w-0 flex items-center gap-2">
        {attachment.isImage ? (
          <ImageIcon className="size-4 text-muted-foreground" />
        ) : (
          <PaperclipIcon className="size-4 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {attachment.filename || "Untitled attachment"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatBytes(attachment.size)}
            {attachment.mimeType ? ` · ${attachment.mimeType}` : ""}
          </p>
        </div>
      </div>
      <DownloadSimpleIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
    </a>
  );
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-green-100 text-green-800",
  neutral: "bg-gray-100 text-gray-800",
  negative: "bg-red-100 text-red-800",
  urgent: "bg-orange-100 text-orange-800",
};

function SuggestedTaskItem({
  task,
  orgId,
  customerId,
}: {
  task: { message: string; dueInDays: number };
  orgId: string;
  customerId: string | null;
}) {
  const queryClient = useQueryClient();
  const addTask = useMutation({
    mutationFn: () =>
      createTask({
        orgId,
        customerId: customerId!,
        message: task.message,
        dueAt: Date.now() + task.dueInDays * 24 * 60 * 60 * 1000,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs">{task.message}</p>
        <p className="text-[10px] text-muted-foreground">
          Due in {task.dueInDays} day{task.dueInDays === 1 ? "" : "s"}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 text-xs"
        onClick={() => addTask.mutate()}
        disabled={!customerId || addTask.isPending || addTask.isSuccess}
      >
        {addTask.isSuccess ? (
          <>
            <CheckIcon className="size-3" />
            Added
          </>
        ) : addTask.isPending ? (
          "Adding..."
        ) : (
          "Add task"
        )}
      </Button>
    </div>
  );
}

function AIAnalysisPanel({
  analysis,
  orgId,
  customerId,
}: {
  analysis: EmailAnalysis;
  orgId: string;
  customerId: string | null;
}) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Summary
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] ${SENTIMENT_COLORS[analysis.sentiment] ?? ""}`}
          >
            {analysis.sentiment}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed">{analysis.summary}</p>
      </div>

      {analysis.suggestedTasks.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Suggested tasks
          </span>
          {!customerId && (
            <p className="text-[10px] text-muted-foreground">
              Mark as customer first to add tasks.
            </p>
          )}
          {analysis.suggestedTasks.map((task, i) => (
            <SuggestedTaskItem
              key={i}
              task={task}
              orgId={orgId}
              customerId={customerId}
            />
          ))}
        </div>
      )}

      {analysis.translation && (
        <div className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Translation (Spanish)
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {analysis.translation}
          </p>
        </div>
      )}
    </div>
  );
}

export function EmailDetailContent({
  orgId,
  email,
}: {
  orgId: string;
  email: EmailListItem;
}) {
  const queryClient = useQueryClient();
  const formattedDate = new Date(email.date).toLocaleString();

  const markCustomer = useMutation({
    mutationFn: () => markAsCustomer(orgId, email.fromAddr),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails", orgId] });
      queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
    },
  });

  const detailQuery = useQuery({
    queryKey: ["email-detail", orgId, email.id],
    queryFn: () => fetchEmailDetail(orgId, email.id),
    enabled: Boolean(orgId) && Boolean(email.id),
  });

  const analysisQuery = useQuery({
    queryKey: ["email-analysis", orgId, email.id],
    queryFn: () => analyzeEmail(orgId, email.id),
    enabled: false,
  });

  const detail = detailQuery.data;
  const bodyHtml = detail?.resolvedBodyHtml ?? email.bodyHtml;
  const bodyText = detail?.resolvedBodyText ?? email.bodyText;
  const attachments = detail?.attachments ?? [];
  const downloadableAttachments = attachments.filter(
    (attachment) => !attachment.isInline || !attachment.isImage,
  );
  const inlineImages = attachments.filter(
    (attachment) => attachment.isInline && attachment.isImage,
  );
  const hasAnyAttachment = downloadableAttachments.length > 0;
  const sanitizedHtml = bodyHtml
    ? DOMPurify.sanitize(bodyHtml, { USE_PROFILES: { html: true } })
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col space-y-7">
      <div className="space-y-1 text-xs leading-relaxed">
        <p>
          <span className="text-muted-foreground">From: </span>
          <span className="font-medium">
            {email.fromName
              ? `${email.fromName} <${email.fromAddr}>`
              : email.fromAddr}
          </span>
        </p>
        {email.toAddr && (
          <p>
            <span className="text-muted-foreground">To: </span>
            {email.toAddr}
          </p>
        )}
        <p>
          <span className="text-muted-foreground">Date: </span>
          {formattedDate}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => analysisQuery.refetch()}
          disabled={analysisQuery.isFetching}
        >
          {analysisQuery.isFetching ? (
            <CircleNotchIcon className="size-4 animate-spin" />
          ) : (
            <SparkleIcon className="size-4" />
          )}
          {analysisQuery.isFetching ? "Analyzing..." : "Analyze"}
        </Button>
        {!email.isCustomer && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markCustomer.mutate()}
            disabled={markCustomer.isPending}
          >
            <UserPlusIcon className="size-4" />
            {markCustomer.isPending ? "Saving..." : "Mark as customer"}
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {detailQuery.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-[85%]" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {detailQuery.isError && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                We could not fetch live attachment data. Showing stored content.
              </p>
            )}

            {analysisQuery.data && (
              <AIAnalysisPanel
                analysis={analysisQuery.data}
                orgId={orgId}
                customerId={email.customerId}
              />
            )}

            {analysisQuery.isError && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Failed to analyze email. Please try again.
              </p>
            )}

            {hasAnyAttachment && (
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <PaperclipIcon className="size-3.5" />
                  Attachments
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {downloadableAttachments.map((attachment) => (
                    <AttachmentItem
                      key={attachment.attachmentId}
                      attachment={attachment}
                    />
                  ))}
                </div>
              </section>
            )}

            {inlineImages.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {inlineImages.length} inline image
                {inlineImages.length === 1 ? "" : "s"} loaded from the original
                email.
              </p>
            )}

            <div>
              {sanitizedHtml ? (
                <div
                  className="prose prose-sm max-w-none text-xs leading-relaxed text-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              ) : (
                <pre className="prose prose-sm max-w-none text-xs leading-relaxed text-foreground">
                  {bodyText ?? ""}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
