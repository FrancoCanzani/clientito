import { MailboxPageHeader } from "@/features/email/shell/mailbox-page";
import { cn } from "@/lib/utils";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  SETTINGS_SECTIONS,
  findSettingsSectionByRouteId,
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
      <nav
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/40 px-3 py-2"
        aria-label="Settings"
      >
        {SETTINGS_SECTIONS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            params={{ mailboxId }}
            className={cn(
              "inline-flex h-8 shrink-0 items-center px-3 text-xs text-muted-foreground transition-colors",
              "hover:bg-muted/60 hover:text-foreground",
              item.destructive && "hover:text-destructive",
            )}
            activeProps={{
              className: cn(
                "inline-flex h-8 shrink-0 items-center px-3 text-xs font-medium",
                item.destructive
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-foreground",
              ),
            }}
          >
            {item.title}
          </Link>
        ))}
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
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
                  : "border-border/40",
              )}
            />
          </div>
        )}

        <div className="min-w-0 px-3 pb-12 md:px-4">{children}</div>
      </div>
    </div>
  );
}
