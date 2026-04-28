import { createRouter } from "@tanstack/react-router";
import { queryClient } from "./lib/query-client";
import { routeTree } from "./routeTree.gen";

function DefaultPending() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-8">
      <p className="animate-pulse text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

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
