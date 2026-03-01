import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createTask } from "@/features/customers/api";
import {
  CheckIcon,
  CircleNotchIcon,
  PaperclipIcon,
  SparkleIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { markAsCustomer } from "../mutations/mark-as-customer";
import { analyzeEmail } from "../queries/analyze-email";
import { fetchEmailDetail } from "../queries/fetch-email-detail";
import type { EmailAnalysis, EmailListItem } from "../types";
import { prepareEmailHtml } from "../utils/prepare-email-html";
import { AttachmentItem } from "./attachment-item";
import { EmailHtmlRenderer } from "./email-html-renderer";

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
          {analysis.suggestedTasks.map((task, index) => (
            <SuggestedTaskItem
              key={`${task.message}-${index}`}
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
  const preparedHtml = useMemo(
    () => (bodyHtml ? prepareEmailHtml(bodyHtml) : null),
    [bodyHtml],
  );

  return (
    <div className="flex h-full min-h-0 flex-col items-start space-y-3">
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

            {downloadableAttachments.length > 0 && (
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

            <div>
              {preparedHtml ? (
                <EmailHtmlRenderer html={preparedHtml} />
              ) : (
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
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
