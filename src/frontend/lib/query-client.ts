import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

queryClient.setQueryDefaults(["email-ai-detail"], {
  staleTime: 5 * 60_000,
  gcTime: 10 * 60_000,
  retry: 1,
});
