import { Error } from "@/components/error";
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => <Outlet />,
  errorComponent: Error,
});
