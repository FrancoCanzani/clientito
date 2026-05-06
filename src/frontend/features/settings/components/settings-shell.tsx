import { MailboxPageHeader } from "@/features/email/shell/mailbox-page";
import { cn } from "@/lib/utils";
import {
  Link,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  findSettingsSectionByRouteId,
  type SettingsGroup,
} from "./settings-sections";

export function SettingsShell({ children }: { children: ReactNode }) {
  const { mailboxId } = useParams({
    from: "/_dashboard/$mailboxId/settings",
  });
  const activeSection = useRouterState({
    select: (state) => {
      for (const match of [...state.matches].reverse()) {
        const found = findSettingsSectionByRouteId(match.routeId);
        if (found) return found;
      }
      return undefined;
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MailboxPageHeader title="Settings" />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-y-auto border-r border-border/60 lg:block">
          <nav className="p-1">
            {SETTINGS_GROUPS.map((group) => (
              <SettingsNavGroup
                key={group}
                group={group}
                mailboxId={mailboxId}
              />
            ))}
          </nav>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto">
          {activeSection && (
            <div className="px-3 pt-6 pb-3 md:px-4">
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">
                  {activeSection.group}
                </p>
                <h2
                  className={cn(
                    "text-xs font-medium",
                    activeSection.destructive
                      ? "text-destructive"
                      : "text-foreground",
                  )}
                >
                  {activeSection.title}
                </h2>
                <p className="max-w-lg text-xs text-muted-foreground">
                  {activeSection.description}
                </p>
              </div>
              <div
                className={cn(
                  "mt-4 border-t",
                  activeSection.destructive
                    ? "border-destructive/30"
                    : "border-border/60",
                )}
              />
            </div>
          )}

          <div className="min-w-0 px-3 pb-12 md:px-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SettingsNavGroup({
  group,
  mailboxId,
}: {
  group: SettingsGroup;
  mailboxId: number;
}) {
  const items = SETTINGS_SECTIONS.filter((section) => section.group === group);
  if (items.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="px-3 pt-3 pb-1 text-[10px] font-medium text-muted-foreground">
        {group}
      </p>
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          params={{ mailboxId }}
          className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          activeProps={{
            className: cn(
              "block rounded-md px-3 py-1.5 text-xs font-medium",
              "bg-muted text-foreground hover:bg-muted hover:text-foreground",
            ),
          }}
        >
          {item.title}
        </Link>
      ))}
    </div>
  );
}
