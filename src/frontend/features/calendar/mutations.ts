export async function approveProposedEvent(
  proposedId: number,
): Promise<{ googleEventId: string; htmlLink?: string }> {
  const response = await fetch(`/api/calendar/proposed/${proposedId}/approve`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to approve event");
  const json = await response.json();
  return (json as { data: { googleEventId: string; htmlLink?: string } }).data;
}

export async function dismissProposedEvent(
  proposedId: number,
): Promise<void> {
  const response = await fetch(`/api/calendar/proposed/${proposedId}/dismiss`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to dismiss event");
}
