import { Error as RouteError } from "@/components/error";
import FolderPage from "@/features/email/inbox/pages/folder-page";
import { fetchLocalViewPage } from "@/features/email/mail/queries";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { parseEmailFolderParam } from "@/features/email/mail/views";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const folderPageSearchSchema = z.object({
  emailId: z.string().min(1).optional(),
});

export const Route = createFileRoute("/_dashboard/$mailboxId/$folder/")({
  validateSearch: folderPageSearchSchema,
  params: {
    parse: (raw) => ({ folder: parseEmailFolderParam(raw.folder) }),
  },
  skipRouteOnParseError: { params: true },
  loader: async ({ context, params }) => {
    await context.queryClient.ensureInfiniteQueryData({
      queryKey: emailQueryKeys.list(params.folder, params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchLocalViewPage({
          view: params.folder,
          mailboxId: params.mailboxId,
          cursor: pageParam || undefined,
        }),
      initialPageParam: "",
      pages: 1,
      getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    });
  },
  errorComponent: RouteError,
  component: FolderPage,
});
