import {
  batchPatchEmails,
  patchEmail,
} from "@/features/email/inbox/mutations";
import type { EmailListItem } from "@/features/email/inbox/types";
import { openEmail as openInboxEmail } from "@/features/email/inbox/utils/open-email";
import type { EmailView } from "@/features/email/inbox/utils/inbox-filters";
import { useQueryClient } from "@tanstack/react-query";
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

export function useEmailInboxActions({
  view,
  mailboxId,
}: {
  view: EmailView;
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

      try {
        if (ids.length === 1) {
          await patchEmail(ids[0]!, data);
        } else {
          await batchPatchEmails(ids, data);
        }

        for (const id of ids) {
          void queryClient.invalidateQueries({ queryKey: ["email-detail", id] });
        }
        void queryClient.invalidateQueries({ queryKey: ["emails"] });
      } catch (error) {
        void queryClient.invalidateQueries({ queryKey: ["emails"] });
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    },
    [queryClient],
  );

  return { openEmail, executeEmailAction };
}
