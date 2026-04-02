import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export function useAgentInvalidation(
  status: "ready" | "streaming" | "submitted" | "error",
  queryClient: QueryClient,
) {
  const prevStatusRef = useRef(status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (
      (prev === "streaming" || prev === "submitted") &&
      status === "ready"
    ) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    }
  }, [status, queryClient]);
}
