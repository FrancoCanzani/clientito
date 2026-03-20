export async function fetchSignature(): Promise<{ signature: string | null }> {
  const response = await fetch("/api/settings/signature");
  if (!response.ok) {
    throw new Error("Failed to fetch signature");
  }
  return response.json();
}

export async function updateSignature(
  signature: string | null,
): Promise<{ signature: string | null }> {
  const response = await fetch("/api/settings/signature", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature }),
  });
  if (!response.ok) {
    throw new Error("Failed to update signature");
  }
  return response.json();
}
