import { emailQueryKeys } from "@/features/email/inbox/query-keys";
import { LoadingEmailsPending } from "@/components/loading-emails-pending";
import { Error as RouteError } from "@/components/error";
import FolderPage from "@/features/email/inbox/pages/folder-page";
import { fetchViewPage } from "@/features/email/inbox/queries";
import { parseEmailFolderParam } from "@/features/email/inbox/utils/inbox-filters";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/$folder/")({
  params: {
    parse: (raw) => ({ folder: parseEmailFolderParam(raw.folder) }),
  },
  skipRouteOnParseError: { params: true },
  loader: async ({ context, params }) => {
    void context.queryClient.prefetchInfiniteQuery({
      queryKey: emailQueryKeys.listBase(params.folder, params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchViewPage({
          view: params.folder,
          mailboxId: params.mailboxId,
          cursor: pageParam || undefined,
        }),
      initialPageParam: "",
      pages: 1,
      getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    });
  },
  pendingComponent: LoadingEmailsPending,
  pendingMs: 120,
  errorComponent: RouteError,
  component: FolderPage,
});
