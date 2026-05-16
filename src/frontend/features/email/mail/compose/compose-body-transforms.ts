import type { MailboxSignature, MailboxTemplate } from "@/hooks/use-mailboxes";
import { buildPlainForwardedHtml } from "@/features/email/mail/thread/build-forwarded-html";

export function splitPlainForwardedContent(content: string) {
  const marker = /-{5,}\s*Forwarded message\s*-{5,}/i;
  const match = content.match(marker);

  if (!match || match.index == null) {
    return null;
  }

  const body = content.slice(0, match.index).trim();
  const forwardedRaw = content.slice(match.index).trim();

  return {
    body,
    forwardedContent: buildPlainForwardedHtml(forwardedRaw),
  };
}

export function splitForwardedContent(content: string) {
  if (!content.includes('data-forwarded-message="true"')) {
    return (
      splitPlainForwardedContent(content) ?? {
        body: content,
        forwardedContent: "",
      }
    );
  }

  if (typeof DOMParser === "undefined") {
    return { body: content, forwardedContent: "" };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const forwardedMessage = doc.body.querySelector(
    '[data-forwarded-message="true"]',
  );

  if (!forwardedMessage) {
    return (
      splitPlainForwardedContent(content) ?? {
        body: content,
        forwardedContent: "",
      }
    );
  }

  const forwardedContent = forwardedMessage.outerHTML;
  const previous = forwardedMessage.previousElementSibling;
  const previousHtml = previous?.outerHTML?.trim().toLowerCase();
  const isSpacer = previousHtml === "<p><br></p>" || previousHtml === "<p></p>";

  if (isSpacer) {
    previous?.remove();
  }
  forwardedMessage.remove();

  const body = doc.body.innerHTML.trim();
  return {
    body,
    forwardedContent,
  };
}

export function detectInsertedSignatureId(content: string): string | null {
  if (!content.includes("data-petit-signature-id")) return null;
  if (typeof DOMParser === "undefined") return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const node = doc.body.querySelector("[data-petit-signature-id]");
  const id = node?.getAttribute("data-petit-signature-id")?.trim();
  return id ? id : null;
}

export function stripInsertedSignature(content: string): string {
  if (!content.includes("data-petit-signature-id")) return content;

  if (typeof DOMParser === "undefined") {
    return content
      .replace(
        /<p><br><\/p>\s*<div[^>]*data-petit-signature-id="[^"]+"[^>]*>[\s\S]*?<\/div>\s*$/i,
        "",
      )
      .replace(
        /<div[^>]*data-petit-signature-id="[^"]+"[^>]*>[\s\S]*?<\/div>\s*$/i,
        "",
      );
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const signatures = doc.body.querySelectorAll("[data-petit-signature-id]");
  signatures.forEach((node) => {
    const previous = node.previousElementSibling;
    const previousHtml = previous?.outerHTML?.trim().toLowerCase();
    const isSpacer =
      previousHtml === "<p><br></p>" || previousHtml === "<p></p>";
    if (isSpacer) {
      previous?.remove();
    }
    node.remove();
  });
  return doc.body.innerHTML.trim();
}

export function stripInsertedTemplates(content: string): string {
  if (!content.includes("data-petit-template-id")) return content;

  if (typeof DOMParser === "undefined") {
    return content
      .replace(
        /<p><br><\/p>\s*<div[^>]*data-petit-template-id="[^"]+"[^>]*>[\s\S]*?<\/div>\s*$/gi,
        "",
      )
      .replace(
        /<div[^>]*data-petit-template-id="[^"]+"[^>]*>[\s\S]*?<\/div>\s*$/gi,
        "",
      );
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const templates = doc.body.querySelectorAll("[data-petit-template-id]");
  templates.forEach((node) => {
    const previous = node.previousElementSibling;
    const previousHtml = previous?.outerHTML?.trim().toLowerCase();
    const isSpacer =
      previousHtml === "<p><br></p>" || previousHtml === "<p></p>";
    if (isSpacer) {
      previous?.remove();
    }
    node.remove();
  });
  return doc.body.innerHTML.trim();
}

export function applySignatureToBody(
  content: string,
  signature: MailboxSignature | null,
): string {
  const withoutSignature = stripInsertedSignature(content);
  if (!signature) return withoutSignature;

  const signatureBlock = `<div data-petit-signature-id="${signature.id}" style="margin-top:16px;border-top:1px solid #dadce0;padding-top:12px;color:#5f6368;font-size:13px;white-space:pre-wrap">${signature.body}</div>`;
  if (!withoutSignature.trim()) {
    return `<p><br></p>${signatureBlock}`;
  }
  return `${withoutSignature}<p><br></p>${signatureBlock}`;
}

export function appendTemplateToBody(
  content: string,
  template: MailboxTemplate,
  signature: MailboxSignature | null,
): string {
  const bodyWithoutSignature = stripInsertedSignature(content);
  const bodyWithoutTemplates = stripInsertedTemplates(bodyWithoutSignature);
  const templateBody = template.body.trim();
  if (!templateBody) {
    return applySignatureToBody(bodyWithoutTemplates, signature);
  }
  const templateBlock = `<div data-petit-template-id="${template.id}">${templateBody}</div>`;
  const nextBody = bodyWithoutTemplates.trim()
    ? `${bodyWithoutTemplates}<p><br></p>${templateBlock}`
    : templateBlock;
  return applySignatureToBody(nextBody, signature);
}

export function combineComposeBody(body: string, forwardedContent: string) {
  const trimmedBody = body.trim();
  const trimmedForwarded = forwardedContent.trim();

  if (!trimmedForwarded) {
    return body;
  }

  if (!trimmedBody) {
    return forwardedContent;
  }

  return `${body}<p><br></p>${forwardedContent}`;
}
