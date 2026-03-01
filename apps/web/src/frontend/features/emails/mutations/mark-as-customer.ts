export type MarkAsCustomerResult = {
  customerId: string;
  emailsLinked: number;
};

export async function markAsCustomer(
  orgId: string,
  emailAddress: string,
  opts?: { name?: string; company?: string },
): Promise<MarkAsCustomerResult> {
  const response = await fetch("/api/emails/mark-customer", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, emailAddress, ...opts }),
  });
  const json = await response.json();
  return json.data;
}
