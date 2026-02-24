import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useLogout } from "@/features/auth/api/auth-api";
import CreateOrganizationSheet from "@/features/workspace/components/create-organization-sheet";
import CreateProjectSheet from "@/features/workspace/components/create-project-sheet";
import {
  getRouteApi,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";

const dashboardRouteApi = getRouteApi("/_dashboard");
const organizationRouteApi = getRouteApi("/_dashboard/$orgId");

export default function AppSidebar() {
  const logout = useLogout();
  const navigate = useNavigate();
  const [isOrgSheetOpen, setIsOrgSheetOpen] = useState(false);
  const [isProjectSheetOpen, setIsProjectSheetOpen] = useState(false);

  const { organizations } = dashboardRouteApi.useLoaderData();
  const { orgId: selectedOrgId, projects } = organizationRouteApi.useLoaderData();

  return (
    <Sidebar>
      <CreateOrganizationSheet
        open={isOrgSheetOpen}
        onOpenChange={setIsOrgSheetOpen}
        onCreated={(orgId) => {
          navigate({
            to: "/$orgId/projects",
            params: { orgId },
          });
        }}
      />

      <CreateProjectSheet
        orgId={selectedOrgId}
        open={isProjectSheetOpen}
        onOpenChange={setIsProjectSheetOpen}
      />

      <SidebarHeader className="space-y-2 border-b">
        <h1>ReleaseLayer</h1>

        <Select
          value={selectedOrgId}
          onValueChange={(nextOrgId) => {
            navigate({
              to: "/$orgId/projects",
              params: { orgId: nextOrgId },
            });
          }}
        >
          <SelectTrigger className="w-full bg-card text-xs">
            <SelectValue placeholder="Select organization" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-col gap-1 divide-y *:text-xs">
          <SidebarMenuButton onClick={() => setIsOrgSheetOpen(true)}>
            New org
          </SidebarMenuButton>
          <SidebarMenuButton onClick={() => setIsProjectSheetOpen(true)}>
            New project
          </SidebarMenuButton>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-2 p-2">
        <div>Projects</div>
        <ScrollArea className="h-[calc(100svh-260px)]">
          <SidebarMenu>
            {projects.map((project) => (
              <SidebarMenuItem key={project.id}>
                <SidebarMenuButton asChild>
                  <Link
                    to="/$orgId/projects/$projectId/releases"
                    params={{
                      orgId: project.orgId,
                      projectId: project.id,
                    }}
                  >
                    <span>{project.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>

          {projects.length === 0 && (
            <p className="px-2 pt-1 text-xs text-muted-foreground">
              No projects in this org.
            </p>
          )}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="text-left"
            >
              <span>{logout.isPending ? "Signing out..." : "Sign out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
