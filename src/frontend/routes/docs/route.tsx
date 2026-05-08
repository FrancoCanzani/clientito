import { DocsSidebarNav } from "@/features/docs/components/docs-sidebar-nav";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/docs")({
 component: DocsLayout,
});

function DocsLayout() {
 return (
 <div className="min-h-svh bg-background text-foreground">
 <header className="border-b p-3">
 <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
 <Link to="/docs" className="text-sm font-semibold">
 Docs
 </Link>
 <Link to="/" className="text-sm">
 Home
 </Link>
 </div>
 </header>

 <div className="mx-auto grid w-full max-w-6xl gap-6 p-4 md:grid-cols-[220px_minmax(0,1fr)]">
 <aside className="hidden border-r pr-4 md:block">
 <DocsSidebarNav />
 </aside>

 <main className="min-w-0">
 <details className="mb-4 md:hidden">
 <summary className="cursor-pointer text-sm font-medium">
 Documents
 </summary>
 <div className="mt-2 border-l pl-3">
 <DocsSidebarNav />
 </div>
 </details>

 <Outlet />
 </main>
 </div>
 </div>
 );
}
