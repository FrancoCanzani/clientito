import type { EmailListResponse } from "@/features/emails/types";
import type {
  PeopleListResponse,
  PersonContext,
  PersonDetailResponse,
} from "./types";

export async function fetchPeople(params?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<PeopleListResponse> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));

  const response = await fetch(`/api/people?${query.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch people");
  return response.json();
}

export async function fetchPersonDetail(
  personId: string | number,
): Promise<PersonDetailResponse> {
  const response = await fetch(`/api/people/${personId}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch person");
  return response.json();
}

export async function fetchPersonContext(
  personId: string | number,
): Promise<PersonContext> {
  const response = await fetch(`/api/dashboard/person/${personId}/context`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch person context");
  const json = await response.json();
  return json.data;
}

export async function fetchPersonEmails(
  personId: string | number,
  params?: { limit?: number; offset?: number },
): Promise<EmailListResponse> {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));

  const response = await fetch(
    `/api/emails/person/${personId}?${query.toString()}`,
    { credentials: "include" },
  );
  if (!response.ok) throw new Error("Failed to fetch person emails");
  return response.json();
}
