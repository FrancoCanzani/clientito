import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  EnvelopeIcon,
  HouseSimpleIcon,
  MagnifyingGlassIcon,
  PaperPlaneRightIcon,
  SparkleIcon,
  StarIcon,
  TrashIcon,
  UsersIcon,
  WarningIcon,
  GearIcon,
  TrayIcon,
} from "@phosphor-icons/react";
import { ChatMessages } from "./chat-messages";
import { useNavigationParser } from "../hooks/use-navigation-parser";
import type { ReactNode } from "react";

type CommandItem = {
  id: string;
  label: string;
  icon: ReactNode;
  section: "navigation" | "email" | "action";
  onSelect: () => void;
  keywords?: string[];
};

export function CommandCenter({
  orgId,
  userId,
}: {
  orgId: string;
  userId: string;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const routerState = useRouterState();

  const agent = useAgent({
    agent: "chat-agent",
    name: `${orgId}-${userId}`,
  });

  const chat = useAgentChat({
    agent,
    body: {
      orgId,
      userId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  const messages = chat.messages ?? [];
  const isLoading = chat.status === "streaming" || chat.status === "submitted";

  useNavigationParser(messages);

  const close = useCallback(() => {
    setOpen(false);
    setChatMode(false);
    setInput("");
    setSelectedIndex(0);
    inputRef.current?.blur();
  }, []);

  // Close on route change
  const pathname = routerState.location.pathname;
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) close();
    prevPathname.current = pathname;
  }, [pathname, close]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  const commands = useMemo<CommandItem[]>(() => [
    {
      id: "home",
      label: "Go to Home",
      icon: <HouseSimpleIcon className="size-4" />,
      section: "navigation",
      keywords: ["home", "dashboard", "overview"],
      onSelect: () => { navigate({ to: "/$orgId", params: { orgId } }); close(); },
    },
    {
      id: "inbox",
      label: "Go to Inbox",
      icon: <TrayIcon className="size-4" />,
      section: "navigation",
      keywords: ["inbox", "emails", "mail"],
      onSelect: () => { navigate({ to: "/$orgId/emails", params: { orgId } }); close(); },
    },
    {
      id: "customers",
      label: "Go to Customers",
      icon: <UsersIcon className="size-4" />,
      section: "navigation",
      keywords: ["customers", "contacts", "people"],
      onSelect: () => { navigate({ to: "/$orgId/customers", params: { orgId } }); close(); },
    },
    {
      id: "sent",
      label: "Sent",
      icon: <PaperPlaneRightIcon className="size-4" />,
      section: "email",
      keywords: ["sent", "outgoing"],
      onSelect: () => { navigate({ to: "/$orgId/emails", params: { orgId }, search: { view: "sent" } }); close(); },
    },
    {
      id: "spam",
      label: "Spam",
      icon: <WarningIcon className="size-4" />,
      section: "email",
      keywords: ["spam", "junk"],
      onSelect: () => { navigate({ to: "/$orgId/emails", params: { orgId }, search: { view: "spam" } }); close(); },
    },
    {
      id: "trash",
      label: "Trash",
      icon: <TrashIcon className="size-4" />,
      section: "email",
      keywords: ["trash", "deleted", "bin"],
      onSelect: () => { navigate({ to: "/$orgId/emails", params: { orgId }, search: { view: "trash" } }); close(); },
    },
    {
      id: "starred",
      label: "Starred",
      icon: <StarIcon className="size-4" />,
      section: "email",
      keywords: ["starred", "important", "flagged"],
      onSelect: () => { navigate({ to: "/$orgId/emails", params: { orgId }, search: { view: "all" } }); close(); },
    },
    {
      id: "settings",
      label: "Settings",
      icon: <GearIcon className="size-4" />,
      section: "navigation",
      keywords: ["settings", "manage", "config", "preferences"],
      onSelect: () => { navigate({ to: "/$orgId/manage", params: { orgId } }); close(); },
    },
  ], [orgId, navigate, close]);

  const query = input.trim().toLowerCase();

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    return commands.filter((cmd) => {
      const haystack = [cmd.label, ...(cmd.keywords ?? [])].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [commands, query]);

  const groupedCommands = useMemo(() => {
    const groups: { section: string; items: CommandItem[] }[] = [];
    const sections = ["navigation", "email", "action"] as const;
    const sectionLabels = { navigation: "Navigation", email: "Email Views", action: "Actions" };
    for (const section of sections) {
      const items = filteredCommands.filter((c) => c.section === section);
      if (items.length > 0) groups.push({ section: sectionLabels[section], items });
    }
    return groups;
  }, [filteredCommands]);

  const allItems = useMemo(() => groupedCommands.flatMap((g) => g.items), [groupedCommands]);

  // Dynamic items: search emails + ask AI (shown when there's input)
  const hasQuery = query.length > 0;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (chatMode) {
      if (e.key === "Escape") {
        setChatMode(false);
        e.preventDefault();
      }
      return;
    }

    const totalItems = allItems.length + (hasQuery ? 2 : 0); // +2 for search & AI

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hasQuery && selectedIndex === allItems.length) {
        // Search emails
        searchEmails();
      } else if (hasQuery && selectedIndex === allItems.length + 1) {
        // Ask AI
        askAI();
      } else if (allItems[selectedIndex]) {
        allItems[selectedIndex].onSelect();
      }
    }
  }

  function searchEmails() {
    navigate({ to: "/$orgId/emails", params: { orgId }, search: { q: input.trim() } });
    close();
  }

  function askAI() {
    const text = input.trim();
    if (!text) return;
    setChatMode(true);
    setInput("");
    chat.sendMessage({ text });
  }

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <div ref={containerRef} className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 w-full max-w-md px-4">
      <div className="rounded-2xl border bg-background shadow-lg overflow-hidden">
        <AnimatePresence>
          {open && !chatMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="max-h-72 overflow-y-auto py-1">
                {groupedCommands.map((group) => (
                  <div key={group.section}>
                    <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {group.section}
                    </div>
                    {group.items.map((item) => {
                      const idx = allItems.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={item.onSelect}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${
                            selectedIndex === idx ? "bg-muted" : ""
                          }`}
                        >
                          <span className="text-muted-foreground">{item.icon}</span>
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {hasQuery && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </div>
                    <button
                      onClick={searchEmails}
                      onMouseEnter={() => setSelectedIndex(allItems.length)}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${
                        selectedIndex === allItems.length ? "bg-muted" : ""
                      }`}
                    >
                      <MagnifyingGlassIcon className="size-4 text-muted-foreground" />
                      Search emails for "{input.trim()}"
                    </button>
                    <button
                      onClick={askAI}
                      onMouseEnter={() => setSelectedIndex(allItems.length + 1)}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${
                        selectedIndex === allItems.length + 1 ? "bg-muted" : ""
                      }`}
                    >
                      <SparkleIcon className="size-4 text-muted-foreground" />
                      Ask AI: "{input.trim()}"
                    </button>
                  </>
                )}

                {!hasQuery && allItems.length === 0 && (
                  <div className="px-3 py-3 text-center text-sm text-muted-foreground">
                    No results
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {open && chatMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 300, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex h-[300px] flex-col">
                <div className="flex items-center justify-between px-3 py-1.5 border-b">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    AI Assistant
                  </span>
                  <button
                    onClick={() => setChatMode(false)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back
                  </button>
                </div>
                <ChatMessages messages={messages} isLoading={isLoading} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 px-3 py-2">
          <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={chatMode ? "Ask AI anything..." : "Search or ask AI anything..."}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {chatMode && input.trim() && (
            <button
              onClick={() => {
                const text = input.trim();
                if (!text) return;
                setInput("");
                chat.sendMessage({ text });
              }}
              className="rounded-full p-1 hover:bg-muted transition-colors"
            >
              <PaperPlaneRightIcon className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
