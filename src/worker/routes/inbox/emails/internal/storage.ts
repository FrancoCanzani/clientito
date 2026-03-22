const DEFAULT_ATTACHMENT_MIME_TYPE = "application/octet-stream";

export async function getAttachmentContent(
  env: Env,
  key: string,
): Promise<ArrayBuffer> {
  const object = await env.ATTACHMENTS.get(key);
  if (!object) throw new Error(`Attachment not found: ${key}`);
  return object.arrayBuffer();
}

export async function putAttachmentFile(
  env: Env,
  key: string,
  file: File,
): Promise<void> {
  await env.ATTACHMENTS.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || DEFAULT_ATTACHMENT_MIME_TYPE,
    },
  });
}

export async function deleteAttachmentFile(
  env: Env,
  key: string,
): Promise<void> {
  await env.ATTACHMENTS.delete(key);
}
