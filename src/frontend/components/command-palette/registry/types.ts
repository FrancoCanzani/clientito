import type { QueryClient } from "@tanstack/react-query";
import type { NavigateFn } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type CommandContext = {
 currentRouteId: string;
 currentView: string | undefined;
 activeMailboxId: number | null;
 defaultMailboxId: number | null;
 selectedEmailId: string | null;
 selectedEmail: {
 fromAddr: string;
 fromName: string | null;
 subject: string | null;
 threadId: string | null;
 mailboxId: number | null;
 } | null;
 composerOpen: boolean;
 isMobile: boolean;
};

export type CommandServices = {
 queryClient: QueryClient;
 navigate: NavigateFn;
 close: () => void;
};

export interface Command {
 id: string;
 label: string | ((ctx: CommandContext) => string);
 icon: ReactNode;
 group: string;
 keywords?: string[];
 shortcut?: string;
 when?: (ctx: CommandContext) => boolean;
 perform: (ctx: CommandContext, services: CommandServices) => void | Promise<void>;
}
