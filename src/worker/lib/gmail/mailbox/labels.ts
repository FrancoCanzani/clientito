import { gmailMutation, gmailRequest } from "../client";
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

  return gmailMutation<GmailLabel>(accessToken, "POST", "/labels", body);
}

export async function updateGmailLabel(
  accessToken: string,
  labelId: string,
  params: { name?: string; color?: GmailLabelColor },
): Promise<GmailLabel> {
  return gmailMutation<GmailLabel>(
    accessToken,
    "PATCH",
    `/labels/${labelId}`,
    params,
  );
}

export async function deleteGmailLabel(
  accessToken: string,
  labelId: string,
): Promise<void> {
  try {
    await gmailMutation(accessToken, "DELETE", `/labels/${labelId}`);
  } catch (error) {
    if (error instanceof Error && /\(404\)/.test(error.message)) return;
    throw error;
  }
}