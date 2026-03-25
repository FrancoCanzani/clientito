import {
  batchPatchEmails,
  markEmailRead,
  patchEmail,
} from "@/features/inbox/mutations";
import type { EmailListItem, EmailListResponse } from "@/features/inbox/types";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
import {
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

const emailsRoute = getRouteApi("/_dashboard/inbox/$id/");

export type EmailInboxAction =
  | "archive"
  | "trash"
  | "spam"
  | "mark-read"
  | "mark-unread"
  | "star"
  | "unstar";

const actionPayloads: Record<
  EmailInboxAction,
  {
    isRead?: boolean;
    archived?: boolean;
    trashed?: boolean;
    spam?: boolean;
    starred?: boolean;
  }
> = {
  archive: { archived: true },
  trash: { trashed: true },
  spam: { spam: true },
  "mark-read": { isRead: true },
  "mark-unread": { isRead: false },
  star: { starred: true },
  unstar: { starred: false },
};

const actionLabels: Record<EmailInboxAction, { one: string; many: (n: number) => string }> = {
  archive: { one: "Conversation archived", many: (n) => `${n} conversations archived` },
  trash: { one: "Conversation moved to trash", many: (n) => `${n} conversations moved to trash` },
  spam: { one: "Conversation reported as spam", many: (n) => `${n} conversations reported as spam` },
  "mark-read": { one: "Conversation marked as read", many: (n) => `${n} conversations marked as read` },
  "mark-unread": { one: "Conversation marked as unread", many: (n) => `${n} conversations marked as unread` },
  star: { one: "Conversation starred", many: (n) => `${n} conversations starred` },
  unstar: { one: "Conversation unstarred", many: (n) => `${n} conversations unstarred` },
};

const REMOVES_FROM_LIST: Set<EmailInboxAction> = new Set([
  "archive",
  "trash",
  "spam",
]);
const IMMEDIATE_ACTIONS: Set<EmailInboxAction> = new Set([
  "mark-read",
  "mark-unread",
]);

type PendingAction = {
  ids: string[];
  data: typeof actionPayloads[EmailInboxAction];
  timer: ReturnType<typeof setTimeout>;
};

export function useEmailInboxActions({
  view,
  mailboxId,
  selectedEmailId,
}: {
  view: EmailView;
  mailboxId: number | null | undefined;
  selectedEmailId: string | null;
}) {
  const navigate = emailsRoute.useNavigate();
  const queryClient = useQueryClient();
  const pendingRef = useRef<PendingAction | null>(null);

  const emailsQueryKey = useMemo(
    () => ["emails", view, mailboxId ?? "all"],
    [mailboxId, view],
  );

  const closeEmail = useCallback(() => {
    navigate({
      search: (prev) => ({ ...prev, id: undefined }),
      replace: true,
    });
  }, [navigate]);

  const openEmail = useCallback(
    (email: EmailListItem) => {
      navigate({
        search: (prev) => ({ ...prev, id: email.id }),
        replace: true,
      });

      if (!email.isRead) {
        queryClient.setQueryData(
          emailsQueryKey,
          (old: InfiniteData<EmailListResponse> | undefined) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                data: page.data.map((current) =>
                  current.id === email.id ? { ...current, isRead: true } : current,
                ),
              })),
            };
          },
        );
        markEmailRead(email.id).catch(() => {
          void queryClient.invalidateQueries({ queryKey: emailsQueryKey });
        });
      }
    },
    [emailsQueryKey, navigate, queryClient],
  );

  const fireMutation = useCallback(
    async (ids: string[], data: typeof actionPayloads[EmailInboxAction]) => {
      try {
        if (ids.length === 1) {
          await patchEmail(ids[0]!, data);
        } else {
          await batchPatchEmails(ids, data);
        }
        void queryClient.invalidateQueries({ queryKey: ["emails"] });
        for (const id of ids) {
          void queryClient.invalidateQueries({ queryKey: ["email-detail", id] });
        }
      } catch (error) {
        queryClient.setQueryData(emailsQueryKey, queryClient.getQueryData(emailsQueryKey));
        void queryClient.invalidateQueries({ queryKey: ["emails"] });
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    },
    [emailsQueryKey, queryClient],
  );

  const executeEmailAction = useCallback(
    (action: EmailInboxAction, explicitIds?: string[]) => {
      const ids =
        explicitIds && explicitIds.length > 0
          ? explicitIds
          : selectedEmailId
            ? [selectedEmailId]
            : [];

      if (ids.length === 0) return;

      if (pendingRef.current) {
        clearTimeout(pendingRef.current.timer);
        const prev = pendingRef.current;
        pendingRef.current = null;
        void fireMutation(prev.ids, prev.data);
      }

      const data = actionPayloads[action];
      const idSet = new Set(ids);
      const removesFromList = REMOVES_FROM_LIST.has(action);

      void queryClient.cancelQueries({ queryKey: emailsQueryKey });

      const snapshot = queryClient.getQueryData<InfiniteData<EmailListResponse>>(emailsQueryKey);

      queryClient.setQueryData(
        emailsQueryKey,
        (old: InfiniteData<EmailListResponse> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: removesFromList
                ? page.data.filter((email) => !idSet.has(email.id))
                : page.data.map((email) => {
                    if (!idSet.has(email.id)) return email;
                    return {
                      ...email,
                      ...(data.isRead !== undefined && { isRead: data.isRead }),
                      ...(data.starred !== undefined && {
                        labelIds: data.starred
                          ? [...email.labelIds, "STARRED"]
                          : email.labelIds.filter((l) => l !== "STARRED"),
                      }),
                    };
                  }),
            })),
          };
        },
      );

      if (removesFromList && selectedEmailId && idSet.has(selectedEmailId)) {
        closeEmail();
      }

      if (IMMEDIATE_ACTIONS.has(action)) {
        void fireMutation(ids, data);
        return;
      }

      const { one, many } = actionLabels[action];
      const count = ids.length;
      const message = count === 1 ? one : many(count);

      const rollback = () => {
        if (pendingRef.current) {
          clearTimeout(pendingRef.current.timer);
          pendingRef.current = null;
        }
        if (snapshot) {
          queryClient.setQueryData(emailsQueryKey, snapshot);
        } else {
          void queryClient.invalidateQueries({ queryKey: ["emails"] });
        }
      };

      const timer = setTimeout(() => {
        if (pendingRef.current?.timer === timer) {
          const pending = pendingRef.current;
          pendingRef.current = null;
          void fireMutation(pending.ids, pending.data);
        }
      }, 5000);

      pendingRef.current = { ids, data, timer };

      toast(message, {
        action: { label: "Undo", onClick: rollback },
        duration: 5000,
      });
    },
    [closeEmail, emailsQueryKey, fireMutation, queryClient, selectedEmailId],
  );

  return { openEmail, closeEmail, executeEmailAction };
}
