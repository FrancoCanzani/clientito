import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { useLogout } from "@/features/auth/api";
import { CaretDownIcon } from "@phosphor-icons/react";
import {
  getRouteApi,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";

const dashboardRouteApi = getRouteApi("/_dashboard");
const organizationRouteApi = getRouteApi("/_dashboard/$orgId");

function getSectionName(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  // segments[0] is orgId, segments[1] is section
  const section = segments[1];
  switch (section) {
    case "customers":
      return "Customers";
    case "emails":
      return "Emails";
    case "manage":
      return "Settings";
    default:
      return "Home";
  }
}

export default function AppHeader() {
  const logout = useLogout();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const { organizations } = dashboardRouteApi.useLoaderData();
  const { orgId: selectedOrgId } = organizationRouteApi.useLoaderData();
  const selectedOrganization = organizations.find(
    (org) => org.id === selectedOrgId,
  );

  const sectionName = getSectionName(pathname);

  return (
    <header className="sticky top-0 z-50 bg-olive-50">
      <div className="mx-auto flex max-w-4xl items-center px-4 py-3 text-sm">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-lg font-medium">
                Clientito
              </BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-accent"
                >
                  <button type="button">
                    {selectedOrganization?.name ?? "Select organization"}
                    <CaretDownIcon className="size-3" />
                  </button>
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
                    <Link to="/new-org">New org</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                  >
                    {logout.isPending ? "Signing out..." : "Sign out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{sectionName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
