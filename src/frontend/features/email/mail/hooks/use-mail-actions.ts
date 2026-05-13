import {
  batchPatchEmails,
  deleteEmailForever,
  patchEmail,
  patchThread,
  type EmailIdentifier,
  type ThreadIdentifier,
} from "@/features/email/mail/mutations";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { invalidateInboxQueries, invalidateEmailDetail } from "@/features/email/mail/data/invalidation";
import type {
  EmailDetailItem,
  EmailListItem,
  EmailListPage,
  EmailThreadItem,
} from "@/features/email/mail/types";
import { openEmail as openInboxEmail } from "@/features/email/mail/utils/open-email";
import {
  applyMailPatchToCaches,
  removeIdsFromInfiniteData,
} from "@/features/email/mail/utils/optimistic-mail-state";
import { unsubscribe } from "@/features/email/subscriptions/queries";
import { useTodoLabel } from "@/features/email/todo/hooks/use-todo-label";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { useUndoAction } from "./use-undo-action";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

export type MailAction =
  | "archive"
  | "move-to-inbox"
  | "trash"
  | "delete-forever"
  | "spam"
  | "not-spam"
  | "mark-read"
  | "mark-unread"
  | "star"
  | "unstar";

const actionPayloads: Partial<
  Record<
    MailAction,
    {
      isRead?: boolean;
      archived?: boolean;
      trashed?: boolean;
      spam?: boolean;
      starred?: boolean;
    }
  >
> = {
  archive: { archived: true },
  "move-to-inbox": { archived: false },
  trash: { trashed: true },
  spam: { spam: true },
  "not-spam": { spam: false },
  "mark-read": { isRead: true },
  "mark-unread": { isRead: false },
  star: { starred: true },
  unstar: { starred: false },
};

// These mutations change which view an email belongs to.
const LIST_CHANGING_ACTIONS = new Set<MailAction>([
  "archive",
  "move-to-inbox",
  "trash",
  "spam",
  "not-spam",
  "delete-forever",
]);

const UNDO_ACTIONS = new Set<MailAction>(["archive", "trash", "spam"]);

const THREAD_LEVEL_ACTIONS = new Set<MailAction>([
  "archive",
  "move-to-inbox",
  "trash",
  "spam",
  "not-spam",
  "mark-read",
  "mark-unread",
]);

const actionMessages: Partial<Record<MailAction, string>> = {
  archive: "Marked as done",
  "move-to-inbox": "Moved to inbox",
  trash: "Moved to trash",
  spam: "Moved to spam",
};

type EmailsCache = InfiniteData<EmailListPage> | undefined;

type InboxMutationVars = {
  action: MailAction;
  ids: string[];
  identifiers: EmailIdentifier[];
  thread?: ThreadIdentifier;
};

export type MailSnoozeTarget =
  | { kind: "email"; identifier: EmailIdentifier }
  | { kind: "thread"; thread: ThreadIdentifier };

export type ExecuteMailActionOptions = {
  identifiers?: EmailIdentifier[];
  onVisible?: () => void;
};

export function useMailActions({
  view,
  mailboxId,
  presentation = "route",
  openContext,
  inboxMode,
}: {
  view: string;
  mailboxId: number;
  presentation?: "route" | "panel";
  openContext?: string;
  inboxMode?: "important" | "all";
}) {
  const navigate = mailboxRoute.useNavigate();
  const queryClient = useQueryClient();

  const undoAction = useUndoAction();

  const openEmail = useCallback(
    (email: EmailListItem) => {
      const routeMailboxId = email.mailboxId ?? mailboxId;
      openInboxEmail(queryClient, navigate, routeMailboxId, email, {
        context: openContext ?? view,
        inboxMode,
        presentation,
      });
    },
    [inboxMode, mailboxId, navigate, openContext, presentation, queryClient, view],
  );

  const mutation = useMutation<void, Error, InboxMutationVars>({
    mutationFn: async ({ identifiers, action, thread }) => {
      if (thread) {
        const data = actionPayloads[action];
        if (!data) return;
        await patchThread(thread, data);
        return;
      }
      if (identifiers.length === 0) return;
      if (action === "delete-forever") {
        await Promise.all(identifiers.map((id) => deleteEmailForever(id)));
        return;
      }
      const data = actionPayloads[action];
      if (!data) return;
      if (identifiers.length === 1) {
        await patchEmail(identifiers[0]!, data);
      } else {
        await batchPatchEmails(identifiers, data);
      }
    },
    onError: (error, { ids }) => {
      toast.error(error instanceof Error ? error.message : "Action failed");
      invalidateInboxQueries();
      for (const id of ids) {
        invalidateEmailDetail(id);
      }
    },
  });

  const executeEmailAction = useCallback(
    async (
      action: MailAction,
      explicitIds?: string[],
      threadContext?: ThreadIdentifier,
      options: ExecuteMailActionOptions = {},
    ) => {
      const ids = explicitIds && explicitIds.length > 0 ? explicitIds : [];
      if (ids.length === 0) return;

      const idSet = new Set(ids);
      const snapshots = queryClient.getQueriesData<EmailsCache>({
        queryKey: emailQueryKeys.all(),
      });
      const detailSnapshots = queryClient.getQueriesData<EmailDetailItem>({
        queryKey: ["email-detail"],
      });
      const threadSnapshots = queryClient.getQueriesData<EmailThreadItem[]>({
        queryKey: ["email-thread"],
      });
      const itemById = new Map<string, EmailListItem>();
      for (const [, cache] of snapshots) {
        for (const page of cache?.pages ?? []) {
          for (const item of page.emails) {
            if (idSet.has(item.id)) itemById.set(item.id, item);
          }
        }
      }

      const identifiers = ids
        .map((id): EmailIdentifier | null => {
          const item = itemById.get(id);
          const fallback = options.identifiers?.find(
            (entry) => entry.id === id,
          );
          if (!item && fallback) return fallback;
          if (!item || !item.mailboxId) return null;
          return {
            id: item.id,
            providerMessageId: item.providerMessageId,
            mailboxId: item.mailboxId,
            labelIds: item.labelIds,
          };
        })
        .filter((e): e is EmailIdentifier => e !== null);

      const thread =
        threadContext && THREAD_LEVEL_ACTIONS.has(action)
          ? threadContext
          : undefined;
      const data = actionPayloads[action];

      if (identifiers.length === 0 && !thread) return;

      const applyVisibleChange = () => {
        if (data) {
          applyMailPatchToCaches(
            queryClient,
            {
              ids,
              providerMessageIds: identifiers.map(
                (entry) => entry.providerMessageId,
              ),
              threadId: thread?.threadId,
            },
            data,
          );
        }
        if (LIST_CHANGING_ACTIONS.has(action)) {
          queryClient.setQueriesData<InfiniteData<EmailListPage> | undefined>(
            { queryKey: emailQueryKeys.list(view, mailboxId) },
            (current) => removeIdsFromInfiniteData(current, idSet),
          );
        }
        options.onVisible?.();
      };

      const restoreSnapshots = () => {
        for (const [queryKey, data] of snapshots) {
          queryClient.setQueryData(queryKey, data);
        }
        for (const [queryKey, data] of detailSnapshots) {
          queryClient.setQueryData(queryKey, data);
        }
        for (const [queryKey, data] of threadSnapshots) {
          queryClient.setQueryData(queryKey, data);
        }
      };

      const doAction = async () => {
        try {
          await mutation.mutateAsync({ action, ids, identifiers, thread });
        } catch {
          // Errors are surfaced via the mutation onError toast + cache rollback.
        }
      };

      if (UNDO_ACTIONS.has(action)) {
        undoAction({
          action: doAction,
          onAction: applyVisibleChange,
          onUndo: () => {
            restoreSnapshots();
          },
          message: actionMessages[action] ?? "Done",
        });
      } else {
        applyVisibleChange();
        await doAction();
      }
    },
    [mailboxId, mutation, queryClient, undoAction, view],
  );

  const todo = useTodoLabel(mailboxId);

  const snooze = useCallback(
    async (target: MailSnoozeTarget, timestamp: number | null) => {
      try {
        if (target.kind === "thread") {
          await patchThread(target.thread, { snoozedUntil: timestamp });
        } else {
          await patchEmail(target.identifier, { snoozedUntil: timestamp });
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to snooze",
        );
      }
    },
    [],
  );

  const unsubscribeMutation = useMutation({
    mutationFn: (email: EmailListItem) =>
      unsubscribe({
        fromAddr: email.fromAddr,
        unsubscribeUrl: email.unsubscribeUrl ?? undefined,
        unsubscribeEmail: email.unsubscribeEmail ?? undefined,
      }),
    onSuccess: (result) => {
      if (result.method === "manual" && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
        toast.info("Opened unsubscribe page");
        return;
      }
      const archived = result.archivedCount ?? 0;
      toast.success(
        archived > 0
          ? `Unsubscribed — ${archived} ${archived === 1 ? "email" : "emails"} archived`
          : "Unsubscribed",
      );
      invalidateInboxQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    openEmail,
    executeEmailAction,
    snooze,
    todo,
    unsubscribe: unsubscribeMutation,
  };
}
