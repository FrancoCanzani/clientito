import { Error as RouteError } from "@/components/error";
import InboxPage from "@/features/email/inbox/pages/inbox-page";
import { fetchLocalViewPage } from "@/features/email/mail/queries";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function normalizeEmailIdSearch(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

const inboxPageSearchSchema = z.object({
  emailId: z.preprocess(normalizeEmailIdSearch, z.string().min(1)).optional(),
  mode: z.enum(["important", "all"]).optional(),
});

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/")({
  validateSearch: inboxPageSearchSchema,
  loaderDeps: ({ search }) => ({
    mode: search.mode ?? "important",
  }),
  loader: async ({ context, params, deps }) => {
    const view = deps.mode === "all" ? "inbox" : "important";
    await context.queryClient.ensureInfiniteQueryData({
      queryKey: emailQueryKeys.list(view, params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchLocalViewPage({
          view,
          mailboxId: params.mailboxId,
          cursor: pageParam || undefined,
        }),
      initialPageParam: "",
      pages: 1,
      getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    });
  },
  errorComponent: RouteError,
  component: InboxPage,
});
