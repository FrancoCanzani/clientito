import {
  batchPatchEmails,
  markEmailRead,
  patchEmail,
} from "@/features/emails/mutations";
import type { EmailSelection } from "@/features/emails/hooks/use-email-selection";
import type { EmailListItem, EmailListResponse } from "@/features/emails/types";
import type { EmailView } from "@/features/emails/utils/inbox-filters";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

const emailsRoute = getRouteApi("/_dashboard/inbox");

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

export function useEmailInboxActions({
  view,
  selectedEmailId,
  selectedIds,
  selection,
  onSelectionCleared,
}: {
  view: EmailView;
  selectedEmailId: string | null;
  selectedIds: string[];
  selection: EmailSelection;
  onSelectionCleared: () => void;
}) {
  const navigate = emailsRoute.useNavigate();
  const queryClient = useQueryClient();

  const emailsQueryKey = useMemo(() => ["emails", view], [view]);

  const closeEmail = useCallback(() => {
    navigate({
      search: (prev) => ({
        ...prev,
        id: undefined,
      }),
      replace: true,
    });
  }, [navigate]);

  const openEmail = useCallback(
    (email: EmailListItem) => {
      navigate({
        search: (prev) => ({
          ...prev,
          id: email.id,
        }),
        replace: true,
      });

      if (!email.isRead) {
        queryClient.setQueryData(
          emailsQueryKey,
          (old: InfiniteData<EmailListResponse> | undefined) => {
            if (!old) {
              return old;
            }

            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                data: page.data.map((current) =>
                  current.id === email.id
                    ? { ...current, isRead: true }
                    : current,
                ),
              })),
            };
          },
        );

        void markEmailRead(email.id);
      }
    },
    [emailsQueryKey, navigate, queryClient],
  );

  const mutation = useMutation({
    mutationFn: async ({
      ids,
      data,
    }: {
      ids: string[];
      data: {
        isRead?: boolean;
        archived?: boolean;
        trashed?: boolean;
        starred?: boolean;
      };
    }) => {
      if (ids.length === 1) {
        await patchEmail(ids[0]!, data);
        return;
      }

      await batchPatchEmails(ids, data);
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      for (const id of variables.ids) {
        void queryClient.invalidateQueries({ queryKey: ["email-detail", id] });
      }

      const closesSelectedEmail =
        variables.data.archived === true || variables.data.trashed === true;
      if (closesSelectedEmail && selectedEmailId) {
        if (variables.ids.includes(selectedEmailId)) {
          closeEmail();
        }
      }

      if (selection.count > 0) {
        selection.deselectAll();
        onSelectionCleared();
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const executeEmailAction = useCallback(
    (action: EmailInboxAction, explicitIds?: string[]) => {
      const ids =
        explicitIds && explicitIds.length > 0
          ? explicitIds
          : selectedIds.length > 0
            ? selectedIds
            : selectedEmailId
              ? [selectedEmailId]
              : [];

      if (ids.length === 0) {
        return;
      }

      mutation.mutate({
        ids,
        data: actionPayloads[action],
      });
    },
    [mutation, selectedEmailId, selectedIds],
  );

  return {
    openEmail,
    closeEmail,
    executeEmailAction,
    mutationPending: mutation.isPending,
  };
}
