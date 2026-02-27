import {
  AddressBookIcon,
  EnvelopeIcon,
  HouseLineIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { getRouteApi, Link, useRouterState } from "@tanstack/react-router";

const organizationRouteApi = getRouteApi("/_dashboard/$orgId");

const navItems = [
  { label: "Home", path: "" as const, icon: HouseLineIcon },
  { label: "Customers", path: "customers" as const, icon: UsersIcon },
  { label: "Contacts", path: "contacts" as const, icon: AddressBookIcon },
  { label: "Emails", path: "emails" as const, icon: EnvelopeIcon },
];

export default function BottomNav() {
  const { orgId } = organizationRouteApi.useLoaderData();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  function isActive(itemPath: string) {
    const base = `/${orgId}`;
    if (itemPath === "") {
      return pathname === base || pathname === `${base}/`;
    }
    return pathname.startsWith(`${base}/${itemPath}`);
  }

  return (
    <nav className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-xl border bg-background px-1.5 py-1 shadow-lg">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.label}
              to={item.path === "" ? "/$orgId" : `/$orgId/${item.path}`}
              params={{ orgId: orgId }}
              className={`rounded-lg p-2 transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="size-5" weight={active ? "fill" : "regular"} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
