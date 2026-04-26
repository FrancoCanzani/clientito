import { PageHeader } from "@/components/page-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Link, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";

type NavGroup = {
  label: string;
  items: { to: SettingsNavTo; label: string }[];
};

type SettingsNavTo =
  | "/$mailboxId/settings/account"
  | "/$mailboxId/settings/appearance"
  | "/$mailboxId/settings/mailbox"
  | "/$mailboxId/settings/signatures"
  | "/$mailboxId/settings/templates"
  | "/$mailboxId/settings/labels"
  | "/$mailboxId/settings/ai"
  | "/$mailboxId/settings/danger";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "General",
    items: [
      { to: "/$mailboxId/settings/account", label: "Account" },
      { to: "/$mailboxId/settings/appearance", label: "Appearance" },
    ],
  },
  {
    label: "Mail",
    items: [
      { to: "/$mailboxId/settings/mailbox", label: "Mailbox" },
      { to: "/$mailboxId/settings/signatures", label: "Signatures" },
      { to: "/$mailboxId/settings/templates", label: "Templates" },
      { to: "/$mailboxId/settings/labels", label: "Labels" },
      { to: "/$mailboxId/settings/ai", label: "AI" },
    ],
  },
  {
    label: "Safety",
    items: [{ to: "/$mailboxId/settings/danger", label: "Danger zone" }],
  },
];

export function SettingsShell({ children }: { children: ReactNode }) {
  const { mailboxId } = useParams({
    from: "/_dashboard/$mailboxId/settings",
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span>Settings</span>
          </div>
        }
        className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      />

      <div className="mx-auto w-full max-w-6xl px-4 pb-12">
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav className="sticky top-20 p-1">
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="mb-2">
                  <p className="px-3 pt-3 pb-1 text-[10px] font-medium text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
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
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function SettingsSectionHeader({
  group,
  title,
  description,
  destructive,
}: {
  group: string;
  title: string;
  description?: string;
  destructive?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground">{group}</p>
      <h2
        className={cn(
          "text-xs font-medium",
          destructive ? "text-destructive" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {description && (
        <p className="max-w-lg text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
