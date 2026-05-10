import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
 fetchEmailDetail,
 fetchEmailThread,
} from "@/features/email/mail/data/thread-detail";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type {
 EmailDetailItem,
 EmailListItem,
 EmailThreadItem,
} from "@/features/email/mail/types";

export function useTodoDetail({
 selectedEmail,
 mailboxId,
 view,
}: {
 selectedEmail: EmailListItem | null;
 mailboxId: number;
 view: string;
}) {
 const detailId = selectedEmail?.id ?? "";
 const detailQuery = useQuery({
 queryKey: emailQueryKeys.detail(detailId || "none"),
 queryFn: () => fetchEmailDetail(detailId, { mailboxId, view }),
 enabled: Boolean(detailId),
 staleTime: 60_000,
 gcTime: 2 * 60_000,
 });

 const currentEmail: EmailDetailItem | null = detailQuery.data ?? null;

 const threadQuery = useQuery({
 queryKey: emailQueryKeys.thread(currentEmail?.threadId ?? "none"),
 queryFn: () =>
 currentEmail?.threadId
 ? fetchEmailThread(currentEmail.threadId)
 : Promise.resolve([]),
 enabled: Boolean(currentEmail?.threadId),
 staleTime: 60_000,
 gcTime: 2 * 60_000,
 });

 const threadMessages: EmailThreadItem[] = useMemo(() => {
 if (!currentEmail) return [];
 if (!currentEmail.threadId) return [currentEmail];
 return threadQuery.data?.length ? threadQuery.data : [currentEmail];
 }, [currentEmail, threadQuery.data]);

 return {
 detailQuery,
 threadQuery,
 currentEmail,
 threadMessages,
 };
}
