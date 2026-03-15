export type UnifiedSearchResult = {
  emails: Array<{
    id: string;
    fromAddr: string;
    fromName: string | null;
    subject: string | null;
    snippet: string | null;
    date: number;
  }>;
};

export async function unifiedSearch(
  q: string,
  limit = 10,
): Promise<UnifiedSearchResult> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  const response = await fetch(`/api/search?${params}`);
  if (!response.ok) throw new Error("Search failed");
  return response.json();
}
