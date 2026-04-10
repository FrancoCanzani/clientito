import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { DocsSidebarNav } from "@/features/docs/components/docs-sidebar-nav";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import type { CSSProperties } from "react";

const docsSidebarVars = {
  "--sidebar": "var(--background)",
  "--sidebar-foreground": "#171411",
  "--sidebar-border": "rgba(41, 33, 24, 0.16)",
  "--sidebar-accent": "rgba(41, 33, 24, 0.06)",
  "--sidebar-accent-foreground": "#171411",
  "--sidebar-ring": "rgba(31, 79, 138, 0.35)",
} as CSSProperties;

export const Route = createFileRoute("/docs")({
  component: DocsLayout,
});

function DocsLayout() {
  return (
    <SidebarProvider defaultOpen>
      <div
        className="flex w-full bg-background text-[#171411] font-['Times_New_Roman',Times,serif] [&_button]:font-['Times_New_Roman',Times,serif]"
        style={docsSidebarVars}
      >
        <Sidebar
          collapsible="offcanvas"
          className="border-r border-[rgba(41,33,24,0.16)] bg-background text-[#171411]"
        >
          <SidebarHeader className="px-4 pt-5 pb-4">
            <div className="space-y-1">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[#5d554c]">
                Petit
              </p>
              <Link
                to="/docs"
                className="text-[1.3rem] leading-[1.1] text-[#171411] no-underline transition-colors hover:text-[#1f4f8a]"
              >
                Documentation
              </Link>
            </div>
          </SidebarHeader>

          <SidebarSeparator className="mx-0 bg-[rgba(41,33,24,0.16)]" />

          <SidebarContent className="px-2 py-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="h-auto min-h-9 rounded-none px-[0.55rem] py-[0.45rem] text-left text-[1rem] leading-[1.35] text-[#171411] hover:bg-[rgba(41,33,24,0.06)] hover:text-[#171411]"
                >
                  <Link to="/">Back to site</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <DocsSidebarNav />
          </SidebarContent>

          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0 bg-transparent">
          <header className="flex items-center justify-between gap-3 border-b border-[rgba(41,33,24,0.16)] px-5 pt-4 md:hidden">
            <SidebarTrigger className="h-9 w-9 rounded-none border border-[rgba(41,33,24,0.16)]" />
            <div className="space-y-0.5">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[#5d554c]">
                Petit
              </p>
              <p className="text-[1.3rem] leading-[1.1] text-[#171411]">
                Documentation
              </p>
            </div>
            <Button
              asChild
              variant="ghost"
              className="rounded-none px-2 text-[0.95rem]"
            >
              <Link to="/">Home</Link>
            </Button>
          </header>

          <div className="mx-auto w-full max-w-300 px-5 pt-6 pb-16 md:pt-8">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
