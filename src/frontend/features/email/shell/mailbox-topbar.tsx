import { Button } from "@/components/ui/button";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { cn } from "@/lib/utils";
import { Link, getRouteApi, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { MailboxMenu } from "./mailbox-menu";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const TABS = [
  { id: "focus", label: "Focus", to: "/$mailboxId/focus" as const },
  { id: "todo", label: "To do", to: "/$mailboxId/todo" as const },
  { id: "inbox", label: "Inbox", to: "/$mailboxId/inbox" as const },
];

type TabId = (typeof TABS)[number]["id"];

function useActiveTab(): TabId | null {
  return useRouterState({
    select: (state) => {
      const matches = state.matches;
      if (matches.some((m) => m.routeId === "/_dashboard/$mailboxId/focus"))
        return "focus";
      if (matches.some((m) => m.routeId === "/_dashboard/$mailboxId/todo"))
        return "todo";
      const inboxRoot = matches.some(
        (m) =>
          m.routeId.startsWith("/_dashboard/$mailboxId/inbox") ||
          m.routeId.startsWith("/_dashboard/$mailboxId/$folder"),
      );
      if (inboxRoot) return "inbox";
      return null;
    },
  });
}

export function MailboxTopbar() {
  const { mailboxId } = mailboxRoute.useParams();
  const activeTab = useActiveTab();
  const { openCompose } = useMailCompose();

  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const index = TABS.findIndex((t) => t.id === activeTab);
    const el = tabRefs.current[index];

    if (!el || !sliderRef.current) return;

    sliderRef.current.style.setProperty("--w", `${el.offsetWidth}px`);
    sliderRef.current.style.setProperty("--x", `${el.offsetLeft}px`);
  }, [activeTab]);

  return (
    <header className="flex shrink-0 items-center gap-1 bg-background p-2">
      <MailboxMenu />

      <nav className="relative flex h-8 items-center" aria-label="Primary">
        <div
          ref={sliderRef}
          className="pointer-events-none absolute inset-y-0.5 left-0 rounded bg-sidebar transition-[width,transform] duration-200 ease-out"
          style={{
            width: "var(--w)",
            transform: "translateX(var(--x))",
          }}
        />

        {TABS.map((tab, i) => (
          <Link
            key={tab.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            to={tab.to}
            params={{ mailboxId }}
            preload="viewport"
            className={cn(
              "z-10 inline-flex h-7 items-center rounded px-3 text-center text-sm transition-all duration-150 ease-out hover:text-primary",
              activeTab == tab.id ? "text-primary" : "text-muted-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant={"secondary"}
          type="button"
          onClick={() => openCompose()}
        >
          New
        </Button>
        <Button variant={"secondary"} asChild>
          <Link
            to="/$mailboxId/inbox/search"
            params={{ mailboxId }}
            preload="viewport"
          >
            Search
          </Link>
        </Button>
      </div>
    </header>
  );
}
