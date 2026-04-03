import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { Link, getRouteApi, useParams } from "@tanstack/react-router";

const inboxRoute = getRouteApi("/_dashboard/inbox/$id/");

export function AccountSwitcher() {
  const params = useParams({ strict: false }) as { id?: string };
  const activeId = params.id ?? "all";
  const search = inboxRoute.useSearch();

  const accountsQuery = useMailboxes();
  const accounts = accountsQuery.data?.accounts ?? [];

  if (accounts.length < 2) return null;

  const options = [
    { id: "all", label: "All accounts" },
    ...accounts
      .filter((account) => account.mailboxId != null)
      .map((account) => ({
        id: String(account.mailboxId),
        label: getMailboxDisplayEmail(account) ?? "Account",
      })),
  ];

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === activeId),
  );
  const nextOption = options[(activeIndex + 1) % options.length] ?? options[0];
  const activeAccount = accounts.find(
    (a) => a.mailboxId != null && String(a.mailboxId) === activeId,
  );
  const label =
    activeId === "all"
      ? "All accounts"
      : ((activeAccount ? getMailboxDisplayEmail(activeAccount) : null) ??
        "Account");

  return (
    <Link
      className="text-muted-foreground hover:text-primary flex items-center gap-1.5 text-xs"
      to="/inbox/$id"
      params={{ id: nextOption.id }}
      search={{
        view: search.view,
        compose: search.compose,
        id: undefined,
        emailId: undefined,
        threadId: undefined,
      }}
    >
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}
