import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { fetchAllLocalViewEmails } from "@/features/email/mail/queries";
import type { EmailListPage } from "@/features/email/mail/types";
import { groupEmailsByThread } from "@/features/email/mail/utils/group-emails-by-thread";
import { TODO_LABEL_NAME } from "@/features/email/labels/internal-labels";
import type { Label } from "@/features/email/labels/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export const todoDataQueryKey = (mailboxId: number) =>
  ["emails", "todo", mailboxId] as const;

function findTodoLabel(labels: Label[]): Label | null {
  const normalizedName = TODO_LABEL_NAME.toLowerCase();
  return labels.find((label) => label.name.toLowerCase() === normalizedName) ?? null;
}

export async function fetchTodoLabelLocal(mailboxId: number): Promise<Label | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  await localDb.ensureReady();
  return findTodoLabel(await localDb.getLabels(userId, mailboxId));
}

export async function fetchTodoPageLocal(
  mailboxId: number,
): Promise<EmailListPage & { label: Label | null }> {
  const label = await fetchTodoLabelLocal(mailboxId);
  if (!label) return { label: null, emails: [], cursor: null };
  const page = await fetchAllLocalViewEmails({
    mailboxId,
    view: label.gmailId,
  });
  return { ...page, label };
}

export function useTodoData({
  mailboxId,
}: {
  mailboxId: number;
}) {
  const emailsQuery = useInfiniteQuery({
    queryKey: todoDataQueryKey(mailboxId),
    queryFn: () => fetchTodoPageLocal(mailboxId),
    initialPageParam: "" as string,
    getNextPageParam: () => undefined,
    staleTime: 5_000,
    gcTime: 2 * 60_000,
  });

  const allEmails = useMemo(
    () => emailsQuery.data?.pages.flatMap((page) => page.emails) ?? [],
    [emailsQuery.data],
  );
  const threadGroups = useMemo(
    () => groupEmailsByThread(allEmails),
    [allEmails],
  );
  const label = emailsQuery.data?.pages[0]?.label ?? null;

  return {
    label,
    labelId: label?.gmailId ?? null,
    hasEmails: threadGroups.length > 0,
    threadGroups,
    isLoading: emailsQuery.isLoading,
    isError: emailsQuery.isError,
  };
}
