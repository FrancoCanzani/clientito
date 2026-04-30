import { GMAIL_API_BASE, gmailRequest } from "../client";
import type {
  GmailLabel,
  GmailLabelColor,
  GmailLabelsListResponse,
} from "../types";

export async function listGmailLabels(
  accessToken: string,
): Promise<GmailLabel[]> {
  const response = await gmailRequest<GmailLabelsListResponse>(
    accessToken,
    "/labels",
  );
  return response.labels ?? [];
}

export async function getGmailLabel(
  accessToken: string,
  labelId: string,
): Promise<GmailLabel> {
  return gmailRequest<GmailLabel>(accessToken, `/labels/${labelId}`, {
    fields:
      "id,name,type,messagesTotal,messagesUnread,threadsTotal,threadsUnread",
  });
}

export async function createGmailLabel(
  accessToken: string,
  params: { name: string; color?: GmailLabelColor },
): Promise<GmailLabel> {
  const body: Record<string, unknown> = {
    name: params.name,
    labelListVisibility: "labelShow",
    messageListVisibility: "show",
  };
  if (params.color) body.color = params.color;

  const response = await fetch(`${GMAIL_API_BASE}/labels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to create Gmail label (${response.status}): ${text}`);
  }

  return (await response.json()) as GmailLabel;
}

export async function updateGmailLabel(
  accessToken: string,
  labelId: string,
  params: { name?: string; color?: GmailLabelColor },
): Promise<GmailLabel> {
  const response = await fetch(`${GMAIL_API_BASE}/labels/${labelId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to update Gmail label (${response.status}): ${text}`);
  }

  return (await response.json()) as GmailLabel;
}

export async function deleteGmailLabel(
  accessToken: string,
  labelId: string,
): Promise<void> {
  const response = await fetch(`${GMAIL_API_BASE}/labels/${labelId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to delete Gmail label (${response.status}): ${text}`);
  }
}
