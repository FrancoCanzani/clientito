import { createRootRoute, Outlet } from "@tanstack/react-router";

function RootErrorComponent({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : "Unexpected application error.";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-lg font-medium">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </main>
  );
}

export const Route = createRootRoute({
  component: () => <Outlet />,
  errorComponent: RootErrorComponent,
});
