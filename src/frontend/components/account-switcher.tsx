import { useMailboxes, type MailboxAccount } from "@/hooks/use-mailboxes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CaretDownIcon, CheckIcon, TrayIcon } from "@phosphor-icons/react";
import { useNavigate, useParams } from "@tanstack/react-router";

function accountInitial(account: MailboxAccount): string {
  return (account.gmailEmail ?? "?")[0].toUpperCase();
}

export function AccountSwitcher() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { id?: string };
  const activeId = params.id ?? "all";

  const accountsQuery = useMailboxes();
  const accounts = accountsQuery.data?.accounts ?? [];

  if (accounts.length < 2) return null;

  const activeAccount = accounts.find(
    (a) => a.mailboxId != null && String(a.mailboxId) === activeId,
  );
  const label = activeId === "all" ? "All accounts" : (activeAccount?.gmailEmail ?? "Account");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs font-normal text-muted-foreground">
          {activeId === "all" ? (
            <TrayIcon className="size-3.5" />
          ) : (
            <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
              {activeAccount ? accountInitial(activeAccount) : "?"}
            </span>
          )}
          {label}
          <CaretDownIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuItem
          onClick={() =>
            navigate({ to: "/inbox/$id", params: { id: "all" } })
          }
          className="gap-2"
        >
          <TrayIcon className="size-3.5" />
          <span className="flex-1">All accounts</span>
          {activeId === "all" && <CheckIcon className="size-3.5 text-muted-foreground" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {accounts.map((account) => {
          const mid = account.mailboxId != null ? String(account.mailboxId) : null;
          if (!mid) return null;
          const isActive = activeId === mid;
          return (
            <DropdownMenuItem
              key={account.accountId}
              onClick={() =>
                navigate({ to: "/inbox/$id", params: { id: mid } })
              }
              className="gap-2"
            >
              <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                {accountInitial(account)}
              </span>
              <span className="flex-1 truncate">{account.gmailEmail ?? "Unknown"}</span>
              {isActive && <CheckIcon className="size-3.5 text-muted-foreground" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
