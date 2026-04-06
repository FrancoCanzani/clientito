import { Error } from "@/components/error";
import { Loading } from "@/components/loading";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: () => <Outlet />,
    errorComponent: Error,
    pendingComponent: Loading,
  },
);
