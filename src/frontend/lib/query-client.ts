import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
    mutations: {
      retry: 4,
      retryDelay: (attempt) =>
        Math.min(30_000, 1000 * 2 ** attempt + Math.random() * 500),
    },
  },
});
