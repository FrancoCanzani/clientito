import "@fontsource-variable/inter/wght.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { localDb } from "./db/client";
import "./index.css";
import {
 APP_VERSION,
 forceSignOut,
 LOCAL_SCHEMA_VERSION,
} from "./lib/app-version";
import { queryClient } from "./lib/query-client";
import { router } from "./router";

const APP_VERSION_POLL_MS = 5 * 60 * 1000;

void (async () => {
 await localDb.ensureReady();
 const stored = await localDb.getMeta("schema_version");
 if (stored && stored !== LOCAL_SCHEMA_VERSION) {
 await forceSignOut("schema_version_changed");
 return;
 }
 if (!stored) await localDb.setMeta("schema_version", LOCAL_SCHEMA_VERSION);
})();

async function checkAppVersion(): Promise<void> {
 if (window.location.pathname.startsWith("/login")) return;
 try {
 const res = await fetch("/api/version");
 if (!res.ok) return;
 const { version } = (await res.json()) as { version?: string };
 if (version && version !== APP_VERSION) {
 await forceSignOut(`app_version_mismatch:${version}`);
 }
 } catch {
 /* network errors are non-fatal */
 }
}

void checkAppVersion();
window.setInterval(checkAppVersion, APP_VERSION_POLL_MS);

createRoot(document.getElementById("root")!).render(
 <StrictMode>
 <QueryClientProvider client={queryClient}>
 <RouterProvider router={router} />
 <Toaster
 toastOptions={{
 classNames: {
 toast:
 " !border !border-border/60 !bg-background !text-foreground !text-xs !gap-2 !min-h-0",
 title: "!text-xs !font-medium",
 description: "!text-[11px] !text-muted-foreground",
 icon: "!size-3",
 actionButton: "!bg-transparent !border-0 !shadow-none !text-muted-foreground !px-1 !h-auto",
 cancelButton: "!h-6 !px-2 !text-[11px]",
 },
 }}
 />
 </QueryClientProvider>
 </StrictMode>,
);
