import { Button } from "@/components/ui/button";
import {
 Sheet,
 SheetContent,
 SheetDescription,
 SheetHeader,
 SheetTitle,
} from "@/components/ui/sheet";
import { ListIcon } from "@phosphor-icons/react";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { MailboxSidebarContent } from "./mailbox-sidebar-content";
import { SettingsSidebarContent } from "./settings-sidebar-content";
import { SidebarExpandedProvider } from "./sidebar-shared";

function useIsSettingsRoute(): boolean {
 return useRouterState({
 select: (state) =>
 state.matches.some((match) =>
 match.routeId.startsWith("/_dashboard/$mailboxId/settings"),
 ),
 });
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
 const isSettings = useIsSettingsRoute();
 return isSettings ? (
 <SettingsSidebarContent onNavigate={onNavigate} />
 ) : (
 <MailboxSidebarContent onNavigate={onNavigate} />
 );
}

export function MailboxSidebar() {
 return (
 <aside className="group/sidebar relative hidden w-12 shrink-0 bg-background md:block">
 <div className="absolute inset-y-0 left-0 z-30 flex w-12 flex-col overflow-hidden border-r border-border/40 bg-background transition-[width,box-shadow] duration-150 ease-out group-hover/sidebar:w-64 group-hover/sidebar:shadow-lg">
 <SidebarExpandedProvider expanded={false}>
 <SidebarBody />
 </SidebarExpandedProvider>
 </div>
 </aside>
 );
}

export function MailboxSidebarTrigger() {
 const [open, setOpen] = useState(false);
 return (
 <Sheet open={open} onOpenChange={setOpen}>
 <Button
 variant="ghost"
 type="button"
 aria-label="Open mailbox sidebar"
 onClick={() => setOpen(true)}
 >
 <ListIcon className="size-4" />
 </Button>
 <SheetContent
 side="left"
 showCloseButton={false}
 className="w-3/4 max-w-none p-0"
 >
 <SheetHeader className="sr-only">
 <SheetTitle>Mailbox sidebar</SheetTitle>
 <SheetDescription>
 Mailbox navigation and account switcher.
 </SheetDescription>
 </SheetHeader>
 <div className="group/sidebar flex h-full w-full flex-col bg-background">
 <SidebarExpandedProvider expanded>
 <SidebarBody onNavigate={() => setOpen(false)} />
 </SidebarExpandedProvider>
 </div>
 </SheetContent>
 </Sheet>
 );
}
