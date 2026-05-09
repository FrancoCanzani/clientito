import { createRouter } from "@tanstack/react-router";
import { queryClient } from "./lib/query-client";
import { routeTree } from "./routeTree.gen";
import { DefaultPending } from "./router-default-pending";

export const router = createRouter({
 routeTree,
 context: { queryClient },
 defaultPreloadStaleTime: 60_000,
 defaultPendingComponent: DefaultPending,
 defaultPendingMs: 200,
 defaultPendingMinMs: 400,
 scrollRestoration: true,
});

declare module "@tanstack/react-router" {
 interface Register {
 router: typeof router;
 }
}
