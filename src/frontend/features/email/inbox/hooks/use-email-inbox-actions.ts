import {
  batchPatchEmails,
  patchEmail,
} from "@/features/email/inbox/mutations";
import type {
  EmailListItem,
  EmailListResponse,
} from "@/features/email/inbox/types";
import { openEmail as openInboxEmail } from "@/features/email/inbox/utils/open-email";
import { queryKeys } from "@/lib/query-keys";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

export type EmailInboxAction =
  | "archive"
  | "move-to-inbox"
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
  "move-to-inbox": { archived: false },
  trash: { trashed: true },
  spam: { spam: true },
  "mark-read": { isRead: true },
  "mark-unread": { isRead: false },
  star: { starred: true },
  unstar: { starred: false },
};

type EmailsCache = InfiniteData<EmailListResponse> | undefined;

function withoutLabel(labels: string[], label: string): string[] {
  return labels.filter((l) => l !== label);
}

function withLabel(labels: string[], label: string): string[] {
  return labels.includes(label) ? labels : [...labels, label];
}

function patchItem(
  item: EmailListItem,
  action: EmailInboxAction,
): EmailListItem {
  switch (action) {
    case "mark-read":
      return { ...item, isRead: true };
    case "mark-unread":
      return { ...item, isRead: false };
    case "star":
      return { ...item, labelIds: withLabel(item.labelIds, "STARRED") };
    case "unstar":
      return { ...item, labelIds: withoutLabel(item.labelIds, "STARRED") };
    case "archive":
      return { ...item, labelIds: withoutLabel(item.labelIds, "INBOX") };
    case "move-to-inbox":
      return { ...item, labelIds: withLabel(item.labelIds, "INBOX") };
    case "trash":
      return { ...item, labelIds: withLabel(item.labelIds, "TRASH") };
    case "spam":
      return { ...item, labelIds: withLabel(item.labelIds, "SPAM") };
  }
}

function removesFromView(action: EmailInboxAction, view: string): boolean {
  switch (action) {
    case "archive":
      return view === "inbox";
    case "move-to-inbox":
      return view === "archived" || view === "spam" || view === "trash";
    case "trash":
      return view !== "trash";
    case "spam":
      return view !== "spam";
    case "unstar":
      return view === "starred";
    default:
      return false;
  }
}

function applyOptimistic(
  cache: EmailsCache,
  view: string,
  action: EmailInboxAction,
  idSet: Set<string>,
): EmailsCache {
  if (!cache) return cache;
  const shouldRemove = removesFromView(action, view);
  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      data: shouldRemove
        ? page.data.filter((item) => !idSet.has(item.id))
        : page.data.map((item) =>
            idSet.has(item.id) ? patchItem(item, action) : item,
          ),
    })),
  };
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

  const executeEmailAction = useCallback(
    async (action: EmailInboxAction, explicitIds?: string[]) => {
      const ids = explicitIds && explicitIds.length > 0 ? explicitIds : [];
      if (ids.length === 0) return;

      const data = actionPayloads[action];
      const idSet = new Set(ids);

      await queryClient.cancelQueries({ queryKey: queryKeys.emails.all() });
      const snapshots = queryClient.getQueriesData<
        InfiniteData<EmailListResponse>
      >({ queryKey: queryKeys.emails.all() });

      // Resolve full email objects from the cache for API calls
      const emailMap = new Map<string, EmailListItem>();
      for (const [, cache] of snapshots) {
        for (const page of cache?.pages ?? []) {
          for (const item of page.data) {
            if (idSet.has(item.id)) emailMap.set(item.id, item);
          }
        }
      }

      const emailIdentifiers = ids
        .map((id) => {
          const item = emailMap.get(id);
          if (!item || !item.mailboxId) return null;
          return {
            id: item.id,
            providerMessageId: item.providerMessageId,
            mailboxId: item.mailboxId,
            labelIds: item.labelIds,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      if (emailIdentifiers.length === 0) return;

      for (const [key] of snapshots) {
        const queryView = key[1] as string | undefined;
        if (!queryView) continue;
        queryClient.setQueryData<InfiniteData<EmailListResponse>>(key, (old) =>
          applyOptimistic(old, queryView, action, idSet),
        );
      }

      try {
        if (emailIdentifiers.length === 1) {
          await patchEmail(emailIdentifiers[0]!, data);
        } else {
          await batchPatchEmails(emailIdentifiers, data);
        }

        for (const id of ids) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.emails.detail(id),
          });
        }
        void queryClient.invalidateQueries({
          queryKey: queryKeys.emails.all(),
          refetchType: "none",
        });
      } catch (error) {
        for (const [key, data] of snapshots) {
          queryClient.setQueryData(key, data);
        }
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    },
    [queryClient],
  );

  return { openEmail, executeEmailAction };
}
