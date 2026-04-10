import { Error } from "@/components/error";
import NotFound from "@/components/not-found";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: () => <Outlet />,
    errorComponent: Error,
    notFoundComponent: NotFound,
  },
);
