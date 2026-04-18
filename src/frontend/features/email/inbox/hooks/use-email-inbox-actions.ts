import {
  batchPatchEmails,
  deleteEmailForever,
  patchEmail,
  type EmailIdentifier,
} from "@/features/email/inbox/mutations";
import type {
  EmailListItem,
  EmailListPage,
} from "@/features/email/inbox/types";
import { openEmail as openInboxEmail } from "@/features/email/inbox/utils/open-email";
import { queryKeys } from "@/lib/query-keys";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

export type EmailInboxAction =
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
    EmailInboxAction,
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
const LIST_CHANGING_ACTIONS = new Set<EmailInboxAction>([
  "archive",
  "move-to-inbox",
  "trash",
  "spam",
  "not-spam",
  "delete-forever",
]);

type EmailsCache = InfiniteData<EmailListPage> | undefined;

type InboxMutationVars = {
  action: EmailInboxAction;
  ids: string[];
  identifiers: EmailIdentifier[];
};

function removeIdsFromInfiniteData(
  current: InfiniteData<EmailListPage> | undefined,
  idSet: Set<string>,
): InfiniteData<EmailListPage> | undefined {
  if (!current) return current;
  let changed = false;
  const pages = current.pages.map((page) => {
    const emails = page.emails.filter((entry) => !idSet.has(entry.id));
    if (emails.length !== page.emails.length) {
      changed = true;
      return { ...page, emails };
    }
    return page;
  });
  return changed ? { ...current, pages } : current;
}

export function useEmailInboxActions({
  view,
  mailboxId,
}: {
  view: string;
  mailboxId: number;
}) {
  const navigate = mailboxRoute.useNavigate();
  const queryClient = useQueryClient();

  const openEmail = useCallback(
    (email: EmailListItem) => {
      const routeMailboxId = email.mailboxId ?? mailboxId;
      openInboxEmail(queryClient, navigate, routeMailboxId, email, {
        context: view,
      });
    },
    [mailboxId, navigate, queryClient, view],
  );

  const mutation = useMutation<void, Error, InboxMutationVars>({
    mutationFn: async ({ identifiers, action }) => {
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
      // Re-sync to roll back optimistic cache and local DB state.
      void queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
      for (const id of ids) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.emails.detail(id),
        });
      }
    },
  });

  const executeEmailAction = useCallback(
    async (action: EmailInboxAction, explicitIds?: string[]) => {
      const ids = explicitIds && explicitIds.length > 0 ? explicitIds : [];
      if (ids.length === 0) return;

      const idSet = new Set(ids);
      const snapshots = queryClient.getQueriesData<EmailsCache>({
        queryKey: queryKeys.emails.all(),
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
          if (!item || !item.mailboxId) return null;
          return {
            id: item.id,
            providerMessageId: item.providerMessageId,
            mailboxId: item.mailboxId,
            labelIds: item.labelIds,
          };
        })
        .filter((e): e is EmailIdentifier => e !== null);

      if (identifiers.length === 0) return;

      if (LIST_CHANGING_ACTIONS.has(action)) {
        const idSet = new Set(ids);
        queryClient.setQueryData<InfiniteData<EmailListPage> | undefined>(
          queryKeys.emails.list(view, mailboxId),
          (current) => removeIdsFromInfiniteData(current, idSet),
        );
      }

      try {
        await mutation.mutateAsync({ action, ids, identifiers });
      } catch (error) {
        console.warn("Inbox action failed", error);
      }
    },
    [mailboxId, mutation, queryClient, view],
  );

  return { openEmail, executeEmailAction };
}
