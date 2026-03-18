import { unifiedSearch } from "@/api/search";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function useUnifiedSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    if (query.length < 2) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: ["unified-search", debouncedQuery],
    queryFn: () => unifiedSearch(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });
}
