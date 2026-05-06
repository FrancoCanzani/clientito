import "@fontsource-variable/inter/wght.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./index.css";
import { queryClient } from "./lib/query-client";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        toastOptions={{
          classNames: {
            toast:
              "!rounded-md !border !border-border/60 !bg-background !text-foreground !text-xs !gap-2 !min-h-0",
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
