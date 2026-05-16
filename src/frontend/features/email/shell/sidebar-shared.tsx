import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type { Icon } from "@phosphor-icons/react";
import { createContext, useContext, type ReactNode } from "react";

const SidebarExpandedContext = createContext(false);

export function SidebarExpandedProvider({
 expanded,
 children,
}: {
 expanded: boolean;
 children: ReactNode;
}) {
 return (
 <SidebarExpandedContext.Provider value={expanded}>
 {children}
 </SidebarExpandedContext.Provider>
 );
}

export function useSidebarExpanded(): boolean {
 return useContext(SidebarExpandedContext);
}

export function SidebarSection({
 title,
 children,
 hoverOnly = false,
 hideTitle = false,
}: {
 title: string;
 children: ReactNode;
 hoverOnly?: boolean;
 hideTitle?: boolean;
}) {
 const expanded = useSidebarExpanded();
 return (
 <section
 className={cn(
 "px-2 py-1",
 hoverOnly && "hidden group-hover/sidebar:block",
 hoverOnly && expanded && "block",
 )}
 >
 {!hideTitle && (
 <div
 className={cn(
 "h-5 overflow-hidden px-2 text-xs font-medium opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
 expanded && "opacity-100",
 )}
 >
 {title}
 </div>
 )}
 <div className="space-y-px">{children}</div>
 </section>
 );
}

export function SidebarRowLabel({
 icon: IconComponent,
 label,
 count,
 shortcutKey,
}: {
 icon: Icon;
 label: string;
 count?: number;
 shortcutKey?: string;
}) {
 const expanded = useSidebarExpanded();
 return (
 <>
 <IconComponent className="size-3.5 shrink-0" />
 <span
 className={cn(
 "min-w-0 flex-1 truncate opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
 expanded && "opacity-100",
 )}
 >
 {label}
 </span>
 {shortcutKey && (
 <Kbd
 className={cn(
 "hidden group-hover/sidebar:inline-flex",
 expanded && "inline-flex",
 )}
 >
 {shortcutKey}
 </Kbd>
 )}
 {count != null && count > 0 && (
 <span
 className={cn(
 "px-1 text-xs tabular-nums opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
 expanded && "opacity-100",
 )}
 >
 {count > 99 ? "99+" : count}
 </span>
 )}
 </>
 );
}

export const sidebarRowClass =
 "flex h-8 w-full items-center gap-3 overflow-hidden rounded px-2 text-xs transition-colors hover:bg-muted";
