import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { beginGmailConnection } from "@/features/onboarding/mutations";
import { useAuth } from "@/hooks/use-auth";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { CaretUpDownIcon } from "@phosphor-icons/react";
import { Link, useNavigate } from "@tanstack/react-router";

function formatDisplayName(
  name: string | null | undefined,
  email: string | null,
) {
  const normalizedName = name?.trim();
  if (normalizedName) return normalizedName;

  const localPart = email
    ?.split("@")[0]
    ?.replace(/[._-]+/g, " ")
    ?.trim();
  if (!localPart) return "Inbox";

  return localPart.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AccountSwitcher({ mailboxId }: { mailboxId: number }) {
  const { user } = useAuth();
  const accounts = (useMailboxes().data?.accounts ?? []).filter(
    (account) => account.mailboxId != null,
  );
  const navigate = useNavigate();

  const activeAccount = accounts.find((account) => account.mailboxId === mailboxId);
  const activeEmail =
    (activeAccount ? getMailboxDisplayEmail(activeAccount) : null) ??
    user?.email ??
    "Inbox";
  const displayName = formatDisplayName(user?.name, activeEmail);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
        >
          <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{displayName}</span>
            <span className="truncate text-xs text-blue-900 dark:text-blue-50">
              {activeEmail}
            </span>
          </div>
          <CaretUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {accounts.map((account) => {
          const email = getMailboxDisplayEmail(account) ?? account.email ?? "";
          const isActive = account.mailboxId === mailboxId;

          return (
            <DropdownMenuItem
              key={account.accountId}
              onSelect={() => {
                if (!isActive && account.mailboxId != null) {
                  void navigate({
                    to: "/$mailboxId/inbox",
                    params: { mailboxId: account.mailboxId },
                  });
                }
              }}
            >
              <span className="min-w-0 flex-1 truncate text-sm">{email}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void beginGmailConnection(`/${mailboxId}/settings`);
          }}
        >
          Add account
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/$mailboxId/settings" params={{ mailboxId }}>
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
