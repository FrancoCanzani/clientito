import "@fontsource-variable/inter/wght.css";
import {
  CheckIcon,
  InfoIcon,
  SpinnerGapIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
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
        icons={{
          success: <CheckIcon className="size-3 text-foreground/75" />,
          info: <InfoIcon className="size-3 text-foreground/65" />,
          warning: <WarningIcon className="size-3 text-foreground/70" />,
          error: <XIcon className="size-3 text-destructive/70" />,
          loading: (
            <SpinnerGapIcon className="size-3 animate-spin text-foreground/60" />
          ),
        }}
        toastOptions={{
          classNames: {
            toast:
              "!min-h-0 !h-10 !px-3 !py-2 !gap-1 !rounded-none !border !border-border/40 !bg-background/96 !shadow-xs",
            title: "!text-xs !font-medium !leading-none",
            description: "!text-xs !leading-none !text-muted-foreground",
            icon: "!size-3 !shrink-0",
            actionButton:
              "!h-6 !px-1.5 !text-xs !font-medium !bg-transparent !border-0 !shadow-none !text-muted-foreground hover:!text-foreground",
            cancelButton:
              "!h-6 !px-1.5 !text-xs !font-medium !bg-transparent !border-0 !shadow-none !text-muted-foreground hover:!text-foreground",
            closeButton:
              "!size-5 !text-muted-foreground hover:!text-foreground",
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
