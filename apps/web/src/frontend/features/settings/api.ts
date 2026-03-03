export async function deleteAccount(): Promise<void> {
  const response = await fetch("/api/settings/account", {
    method: "DELETE",
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? "Failed to delete account",
    );
  }
}
