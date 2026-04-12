import { Error as RouteError } from "@/components/error";
import FolderPage from "@/features/email/inbox/pages/folder-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/email/inbox/queries";
import { parseEmailFolderParam } from "@/features/email/inbox/utils/inbox-filters";
import type { EmailListResponse } from "@/features/email/inbox/types";
import { queryKeys } from "@/lib/query-keys";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/$folder/")({
  params: {
    parse: (raw) => ({ folder: parseEmailFolderParam(raw.folder) }),
  },
  skipRouteOnParseError: { params: true },
  loader: async ({ context, params }) => {
    const initialData = await context.queryClient.ensureInfiniteQueryData({
      queryKey: queryKeys.emails.list(params.folder, params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchEmails({
          view: params.folder,
          mailboxId: params.mailboxId,
          limit: EMAIL_LIST_PAGE_SIZE,
          offset: pageParam,
        }),
      initialPageParam: 0,
      getNextPageParam: (lastPage: EmailListResponse) =>
        lastPage.pagination.hasMore
          ? lastPage.pagination.offset + lastPage.pagination.limit
          : undefined,
    });

    return {
      initialPage: initialData.pages[0],
    };
  },
  errorComponent: RouteError,
  component: FolderPage,
});
