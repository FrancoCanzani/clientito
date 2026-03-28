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

export async function editProposedEvent(
  proposedId: number,
  data: { title?: string; location?: string; startAt?: number; endAt?: number },
): Promise<void> {
  const response = await fetch(`/api/calendar/proposed/${proposedId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update event");
}
