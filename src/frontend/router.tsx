import { createRouter } from "@tanstack/react-router";
import { PendingScreen } from "./components/pending-screen";
import { queryClient } from "./lib/query-client";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreloadStaleTime: 60_000,
  scrollRestoration: true,
  defaultPendingMs: 500,
  defaultPendingMinMs: 300,
  defaultPendingComponent: PendingScreen,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
