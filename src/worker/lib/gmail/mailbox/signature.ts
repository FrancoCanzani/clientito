export function appendSignature(body: string, signature: string | null | undefined): string {
  const trimmed = signature?.trim();
  if (!trimmed) return body;
  return `${body}<div style="margin-top:16px;border-top:1px solid #dadce0;padding-top:12px;color:#5f6368;font-size:13px;white-space:pre-wrap">${trimmed}</div>`;
}
