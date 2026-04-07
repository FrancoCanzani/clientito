import { markEmailRead } from "@/features/email/inbox/mutations";
import { fetchEmailDetailAI } from "@/features/email/inbox/queries";
import type { EmailListItem } from "@/features/email/inbox/types";
import type { EmailView } from "@/features/email/inbox/utils/inbox-filters";
import type { QueryClient } from "@tanstack/react-query";

type FolderView = Exclude<EmailView, "inbox" | "important">;

type NavigateToEmail = (
  options:
    | {
        to: "/$mailboxId/inbox/email/$emailId";
        params: { mailboxId: number; emailId: string };
        replace?: boolean;
      }
    | {
        to: "/$mailboxId/inbox/folders/$folder/email/$emailId";
        params: { mailboxId: number; folder: FolderView; emailId: string };
        replace?: boolean;
      }
    | {
        to: "/$mailboxId/inbox/labels/$label/email/$emailId";
        params: { mailboxId: number; label: "important"; emailId: string };
        replace?: boolean;
      },
) => void;

export function openEmail(
  queryClient: QueryClient,
  navigate: NavigateToEmail,
  routeMailboxId: number,
  email: Pick<EmailListItem, "id" | "isRead">,
  options?: { replace?: boolean; context?: EmailView },
) {
  void queryClient.prefetchQuery({
    queryKey: ["email-ai-detail", email.id],
    queryFn: () => fetchEmailDetailAI(email.id),
  });

  const context = options?.context ?? "inbox";
  if (context === "important") {
    navigate({
      to: "/$mailboxId/inbox/labels/$label/email/$emailId",
      params: { mailboxId: routeMailboxId, label: "important", emailId: email.id },
      replace: options?.replace,
    });
  } else if (context !== "inbox") {
    navigate({
      to: "/$mailboxId/inbox/folders/$folder/email/$emailId",
      params: { mailboxId: routeMailboxId, folder: context, emailId: email.id },
      replace: options?.replace,
    });
  } else {
    navigate({
      to: "/$mailboxId/inbox/email/$emailId",
      params: { mailboxId: routeMailboxId, emailId: email.id },
      replace: options?.replace,
    });
  }

  if (email.isRead) return;

  void markEmailRead(email.id).finally(() => {
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["email-detail", email.id] });
  });
}
