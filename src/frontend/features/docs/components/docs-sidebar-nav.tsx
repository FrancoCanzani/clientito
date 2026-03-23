import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getAllDocs } from "@/features/docs/lib/docs";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

const docs = getAllDocs();
const navLinkClassName = cn(
  "h-auto min-h-9 rounded-none px-[0.55rem] py-[0.45rem] text-left text-[1rem] leading-[1.35] text-[#171411]",
  "hover:bg-[rgba(41,33,24,0.06)] hover:text-[#171411]",
);
const navLinkActiveClassName = "bg-[rgba(41,33,24,0.08)]";

export function DocsSidebarNav() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[0.72rem] uppercase tracking-[0.18em] text-[#5d554c]">
        Documents
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className={navLinkClassName}>
              <Link
                to="/docs"
                activeOptions={{ exact: true }}
                activeProps={{
                  className: cn(navLinkClassName, navLinkActiveClassName),
                }}
              >
                <span>Overview</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {docs.map((doc) => (
            <SidebarMenuItem key={doc.slug}>
              <SidebarMenuButton asChild className={navLinkClassName}>
                <Link
                  to="/docs/$slug"
                  params={{ slug: doc.slug }}
                  activeProps={{
                    className: cn(navLinkClassName, navLinkActiveClassName),
                  }}
                >
                  <span>{doc.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
