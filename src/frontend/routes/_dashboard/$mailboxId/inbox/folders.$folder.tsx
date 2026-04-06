import { EmailFolderPage } from "@/features/inbox/pages/email-list-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/inbox/queries";
import type { EmailListResponse } from "@/features/inbox/types";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";

const emailFolderSchema = z.enum([
  "inbox",
  "starred",
  "sent",
  "archived",
  "spam",
  "trash",
]);

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/folders/$folder",
)({
  loader: async ({ context, params }) => {
    const parsedFolderResult = emailFolderSchema.safeParse(params.folder);
    if (!parsedFolderResult.success) {
      throw notFound();
    }

    const folder = parsedFolderResult.data;

    await context.queryClient.ensureInfiniteQueryData({
      queryKey: ["emails", folder, params.mailboxId],
      queryFn: ({ pageParam }) =>
        fetchEmails({
          view: folder,
          mailboxId: params.mailboxId,
          limit: EMAIL_LIST_PAGE_SIZE,
          offset: pageParam,
        }),
      initialPageParam: 0,
      getNextPageParam: (lastPage: EmailListResponse) =>
        lastPage?.pagination?.hasMore
          ? lastPage.pagination.offset + lastPage.pagination.limit
          : undefined,
    });

    return { folder };
  },
  component: EmailFolderPage,
});
