import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useLogout } from "@/features/auth/api";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";

const dashboardRouteApi = getRouteApi("/_dashboard");
const organizationRouteApi = getRouteApi("/_dashboard/$orgId");

export default function AppSidebar() {
  const logout = useLogout();
  const navigate = useNavigate();

  const { organizations } = dashboardRouteApi.useLoaderData();
  const { orgId: selectedOrgId } = organizationRouteApi.useLoaderData();
  const selectedOrganization = organizations.find((org) => org.id === selectedOrgId);

  return (
    <Sidebar>
      <SidebarHeader className="space-y-2 border-b">
        <h1>Clientito</h1>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="w-full text-xs">
              {selectedOrganization?.name ?? "Select organization"}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={selectedOrgId}
              onValueChange={(value) => {
                navigate({
                  to: "/$orgId",
                  params: { orgId: value },
                });
              }}
            >
              {organizations.map((org) => (
                <DropdownMenuRadioItem key={org.id} value={org.id}>
                  {org.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/$orgId/manage" params={{ orgId: selectedOrgId }}>
                Manage org
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/new-org">
                New org
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="gap-2 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/$orgId" params={{ orgId: selectedOrgId }}>
                Home
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/$orgId/customers" params={{ orgId: selectedOrgId }}>
                Customers
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/$orgId/contacts" params={{ orgId: selectedOrgId }}>
                Contacts
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/$orgId/emails" params={{ orgId: selectedOrgId }}>
                Search Emails
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
