import {
  InboxSidebarShell,
  type MailSidebarItem,
} from "@/features/inbox/components/inbox-sidebar-shell";
import { emailListInfiniteQueryOptions } from "@/features/inbox/queries";
import { queryClient } from "@/lib/query-client";
import { parseMailboxId } from "@/lib/utils";
import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { z } from "zod";

const mailSidebarViews = new Set<MailSidebarItem>([
  "inbox",
  "important",
  "drafts",
  "sent",
  "spam",
  "trash",
  "archived",
  "starred",
  "search",
  "filters",
  "subscriptions",
]);

const MAIL_PATH_TO_ITEM: Array<[suffix: string, item: MailSidebarItem]> = [
  ["/drafts", "drafts"],
  ["/search", "search"],
  ["/filters", "filters"],
  ["/subscriptions", "subscriptions"],
  ["/sent", "sent"],
  ["/starred", "starred"],
  ["/archived", "archived"],
  ["/spam", "spam"],
  ["/trash", "trash"],
];

const mailboxLayoutSearchSchema = z.object({
  view: z.enum(["important"]).optional(),
  compose: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_dashboard/inbox/$id")({
  validateSearch: mailboxLayoutSearchSchema,
  loader: async ({ params }) => {
    const mailboxId = parseMailboxId(params.id) ?? null;

    await queryClient.ensureInfiniteQueryData(
      emailListInfiniteQueryOptions({ view: "inbox", mailboxId }),
    );

    return { mailboxId };
  },
  component: MailboxLayout,
});

function MailboxLayout() {
  const params = Route.useParams();
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const search = router.state.location.search as {
    view?: unknown;
    context?: unknown;
  };
  const mailboxId = parseMailboxId(params.id) ?? null;

  const activeItem =
    MAIL_PATH_TO_ITEM.find(([suffix]) => pathname.endsWith(suffix))?.[1] ??
    (typeof search.context === "string" &&
    mailSidebarViews.has(search.context as MailSidebarItem)
      ? (search.context as MailSidebarItem)
      : typeof search.view === "string" &&
          mailSidebarViews.has(search.view as MailSidebarItem)
        ? (search.view as MailSidebarItem)
        : "inbox");

  return (
    <InboxSidebarShell mailboxId={mailboxId} activeItem={activeItem}>
      <Outlet />
    </InboxSidebarShell>
  );
}
