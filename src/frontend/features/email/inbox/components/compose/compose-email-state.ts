import { emailQueryKeys, draftQueryKeys, scheduledEmailQueryKeys } from "@/features/email/inbox/query-keys";
import {
  useMailboxes,
  type MailboxAccount,
  type MailboxSignature,
  type MailboxTemplate,
} from "@/hooks/use-mailboxes";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAttachmentUpload } from "../../hooks/use-attachment-upload";
import { loadDraft, persistDraftNow, useDraft } from "../../hooks/use-draft";
import { useUndoSend } from "../../hooks/use-undo-send";
import { sendEmail } from "../../mutations";
import { fetchViewPage, invalidateInboxQueries } from "../../queries";
import type { ComposeInitial, DraftState } from "../../types";
import { buildPlainForwardedHtml } from "../../utils/build-forwarded-html";
import { openCompose } from "./compose-events";

type UseComposeEmailOptions = {
  onSent?: () => void;
};

function splitPlainForwardedContent(content: string) {
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

function splitForwardedContent(content: string) {
  if (!content.includes('data-forwarded-message="true"')) {
    return splitPlainForwardedContent(content) ?? {
      body: content,
      forwardedContent: "",
    };
  }

  if (typeof DOMParser === "undefined") {
    return { body: content, forwardedContent: "" };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const forwardedMessage = doc.body.querySelector('[data-forwarded-message="true"]');

  if (!forwardedMessage) {
    return splitPlainForwardedContent(content) ?? {
      body: content,
      forwardedContent: "",
    };
  }

  const forwardedContent = forwardedMessage.outerHTML;
  const previous = forwardedMessage.previousElementSibling;
  const previousHtml = previous?.outerHTML?.trim().toLowerCase();
  const isSpacer =
    previousHtml === "<p><br></p>" || previousHtml === "<p></p>";

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

type AttachmentKey = {
  key: string;
  filename: string;
  mimeType: string;
  size?: number;
};

type SendEmailResult = {
  providerMessageId?: string;
  threadId?: string;
};

function isSendEmailResult(value: unknown): value is SendEmailResult {
  if (typeof value !== "object" || value === null) return false;
  const providerMessageId = Reflect.get(value, "providerMessageId");
  const threadId = Reflect.get(value, "threadId");
  return (
    (providerMessageId === undefined || typeof providerMessageId === "string") &&
    (threadId === undefined || typeof threadId === "string")
  );
}

function detectInsertedSignatureId(content: string): string | null {
  if (!content.includes("data-petit-signature-id")) return null;
  if (typeof DOMParser === "undefined") return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const node = doc.body.querySelector("[data-petit-signature-id]");
  const id = node?.getAttribute("data-petit-signature-id")?.trim();
  return id ? id : null;
}

function stripInsertedSignature(content: string): string {
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

function stripInsertedTemplates(content: string): string {
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

function applySignatureToBody(
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

function appendTemplateToBody(
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

function buildEmailPayload(
  snap: DraftState,
  bodyOverride: string,
  threadId: string | undefined,
  attachmentKeys?: AttachmentKey[],
  scheduledFor?: number,
) {
  return {
    mailboxId: snap.mailboxId ?? undefined,
    to: snap.to,
    cc: snap.cc.trim().length > 0 ? snap.cc.trim() : undefined,
    bcc: snap.bcc.trim().length > 0 ? snap.bcc.trim() : undefined,
    subject: snap.subject,
    body: combineComposeBody(bodyOverride, snap.forwardedContent),
    threadId,
    attachments: attachmentKeys,
    ...(scheduledFor != null && { scheduledFor }),
  };
}

function combineComposeBody(body: string, forwardedContent: string) {
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

function createComposeDraft(initial?: ComposeInitial) {
  const initialContent = initial?.bodyHtml ?? initial?.body ?? "";
  const { body, forwardedContent } = splitForwardedContent(initialContent);

  return {
    mailboxId: initial?.mailboxId ?? null,
    to: initial?.to ?? "",
    cc: initial?.cc ?? "",
    bcc: initial?.bcc ?? "",
    subject: initial?.subject ?? "",
    body,
    forwardedContent,
  };
}

export function getComposePanelKey(initial?: ComposeInitial) {
  if (initial?.composeKey) {
    return initial.composeKey;
  }

  return JSON.stringify({
    mailboxId: initial?.mailboxId ?? null,
    to: initial?.to ?? "",
    cc: initial?.cc ?? "",
    bcc: initial?.bcc ?? "",
    subject: initial?.subject ?? "",
    threadId: initial?.threadId ?? null,
    body: initial?.body ?? "",
    bodyHtml: initial?.bodyHtml ?? "",
  });
}

export function useComposeEmail(
  initial?: ComposeInitial,
  options?: UseComposeEmailOptions,
) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mailboxesQuery = useMailboxes();
  const composeKey = getComposePanelKey(initial);
  const initialDraft = useMemo(() => createComposeDraft(initial), [composeKey]);
  const [draft, setDraft] = useState(() => initialDraft);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const initialAttachments = useMemo(
    () =>
      (initial?.attachmentKeys ?? []).map((file) => ({
        key: file.key,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size ?? 0,
      })),
    [composeKey],
  );
  const attachments = useAttachmentUpload(initialAttachments);
  const bodyRef = useRef(draft.body);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [sendPending, setSendPending] = useState(false);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(
    null,
  );
  const autoSignatureMailboxRef = useRef<number | null>(null);

  const threadId = initial?.threadId;
  const { mailboxId, to, cc, bcc, subject, body, forwardedContent } = draft;

  const viewSentEmail = useCallback(
    async (result: unknown) => {
      const targetMailboxId = draftSnapshotRef.current.mailboxId ?? mailboxId;
      if (!targetMailboxId) return;

      let sentEmailId: string | null = null;
      if (isSendEmailResult(result)) {
        const sentPage = await fetchViewPage({
          mailboxId: targetMailboxId,
          view: "sent",
        });
        const sentEmail = sentPage.emails.find((email) =>
          result.providerMessageId
            ? email.providerMessageId === result.providerMessageId
            : result.threadId
              ? email.threadId === result.threadId
              : false,
        );
        sentEmailId = sentEmail?.id ?? null;
      }

      if (sentEmailId) {
        navigate({
          to: "/$mailboxId/$folder/email/$emailId",
          params: {
            mailboxId: targetMailboxId,
            folder: "sent",
            emailId: sentEmailId,
          },
        });
        return;
      }

      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId: targetMailboxId, folder: "sent" },
      });
    },
    [mailboxId, navigate],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingDraft(true);

    loadDraft(composeKey).then((savedDraft) => {
      if (cancelled) return;

      if (savedDraft) {
        setDraft({
          mailboxId: savedDraft.mailboxId ?? null,
          to: savedDraft.to ?? "",
          cc: savedDraft.cc ?? "",
          bcc: savedDraft.bcc ?? "",
          subject: savedDraft.subject ?? "",
          body: savedDraft.body ?? "",
          forwardedContent: savedDraft.forwardedContent ?? "",
        });
        bodyRef.current = savedDraft.body ?? "";
      } else {
        setDraft(initialDraft);
        bodyRef.current = initialDraft.body;
      }

      setLoadingDraft(false);
    });

    return () => {
      cancelled = true;
    };
  }, [composeKey, initialDraft]);

  const serverDraft = useDraft(composeKey, draft);
  const availableMailboxes = useMemo(
    () =>
      (mailboxesQuery.data?.accounts ?? []).filter(
        (account): account is MailboxAccount & { mailboxId: number } =>
          account.mailboxId != null,
      ),
    [mailboxesQuery.data?.accounts],
  );
  const activeMailbox = useMemo(
    () => availableMailboxes.find((entry) => entry.mailboxId === mailboxId),
    [availableMailboxes, mailboxId],
  );
  const signatures = activeMailbox?.signatures.items ?? [];
  const defaultSignatureId = activeMailbox?.signatures.defaultId ?? null;
  const templates = activeMailbox?.templates.items ?? [];

  useEffect(() => {
    if (draft.mailboxId != null || availableMailboxes.length !== 1) {
      return;
    }
    setDraft((current) => ({
      ...current,
      mailboxId: availableMailboxes[0].mailboxId,
    }));
  }, [availableMailboxes, draft.mailboxId]);

  useEffect(() => {
    if (loadingDraft) return;
    if (mailboxId == null) return;
    if (autoSignatureMailboxRef.current === mailboxId) return;

    const existingSignatureId = detectInsertedSignatureId(bodyRef.current);
    if (existingSignatureId) {
      if (signatures.some((item) => item.id === existingSignatureId)) {
        setSelectedSignatureId(existingSignatureId);
        autoSignatureMailboxRef.current = mailboxId;
        return;
      }
      const cleanedBody = applySignatureToBody(bodyRef.current, null);
      bodyRef.current = cleanedBody;
      setDraft((current) => ({ ...current, body: cleanedBody }));
    }

    const defaultSignature =
      defaultSignatureId != null
        ? signatures.find((item) => item.id === defaultSignatureId) ?? null
        : null;

    if (defaultSignature) {
      const nextBody = applySignatureToBody(bodyRef.current, defaultSignature);
      bodyRef.current = nextBody;
      setDraft((current) => ({ ...current, body: nextBody }));
      setSelectedSignatureId(defaultSignature.id);
    } else {
      setSelectedSignatureId(null);
    }

    autoSignatureMailboxRef.current = mailboxId;
  }, [defaultSignatureId, loadingDraft, mailboxId, signatures]);

  const setMailboxId = (value: number) => {
    autoSignatureMailboxRef.current = null;
    setDraft((current) => ({ ...current, mailboxId: value }));
  };

  const setTo = (value: string) => {
    setDraft((current) => ({ ...current, to: value }));
  };

  const setCc = (value: string) => {
    setDraft((current) => ({ ...current, cc: value }));
  };

  const setBcc = (value: string) => {
    setDraft((current) => ({ ...current, bcc: value }));
  };

  const setSubject = (value: string) => {
    setDraft((current) => ({ ...current, subject: value }));
  };

  const setBody = (value: string) => {
    bodyRef.current = value;
    setDraft((current) => ({ ...current, body: value }));
  };

  const applySignatureById = useCallback(
    (signatureId: string | null) => {
      const signature =
        signatureId != null
          ? signatures.find((item) => item.id === signatureId) ?? null
          : null;
      const nextBody = applySignatureToBody(bodyRef.current, signature);
      bodyRef.current = nextBody;
      setDraft((current) => ({ ...current, body: nextBody }));
      setSelectedSignatureId(signature?.id ?? null);
    },
    [signatures],
  );

  const applyTemplateById = useCallback(
    (templateId: string) => {
      const template = templates.find((item) => item.id === templateId);
      if (!template) return;
      const signature =
        selectedSignatureId != null
          ? signatures.find((item) => item.id === selectedSignatureId) ?? null
          : null;
      const nextBody = appendTemplateToBody(
        bodyRef.current,
        template,
        signature,
      );
      bodyRef.current = nextBody;
      setDraft((current) => ({
        ...current,
        subject: current.subject.trim() ? current.subject : template.subject,
        body: nextBody,
      }));
    },
    [selectedSignatureId, signatures, templates],
  );

  const clearDraft = useCallback(async () => {
    await serverDraft.clearDraft();
    bodyRef.current = initialDraft.body;
    attachments.clear();
    setSendPending(false);
    setSelectedSignatureId(null);
    autoSignatureMailboxRef.current = null;
    setDraft(initialDraft);
  }, [attachments, initialDraft, serverDraft]);

  const saveDraftNow = useCallback(async (targetComposeKey?: string) => {
    const key = targetComposeKey ?? composeKey;
    await persistDraftNow(key, {
      ...draftRef.current,
      body: bodyRef.current,
    });
    queryClient.invalidateQueries({
      queryKey: draftQueryKeys.list(draftRef.current.mailboxId),
    });
    return key;
  }, [composeKey, queryClient]);

  // Snapshot draft state at trigger time so the undo-send closure captures
  // the values that were current when the user pressed Send.
  const draftSnapshotRef = useRef(draft);
  const bodySnapshotRef = useRef(draft.body);
  const attachmentSnapshotRef = useRef<
    AttachmentKey[] | undefined
  >(undefined);

  const undoSend = useUndoSend({
    onSend: () => {
      return sendEmail(
        buildEmailPayload(
          draftSnapshotRef.current,
          bodySnapshotRef.current,
          threadId ?? undefined,
          attachmentSnapshotRef.current,
        ),
      );
    },
    onUndo: () => {
      const snapshot = draftSnapshotRef.current;
      openCompose({
        mailboxId: snapshot.mailboxId,
        to: snapshot.to,
        cc: snapshot.cc,
        bcc: snapshot.bcc,
        subject: snapshot.subject,
        bodyHtml: combineComposeBody(
          bodySnapshotRef.current,
          snapshot.forwardedContent,
        ),
        threadId: threadId ?? undefined,
        composeKey: `undo_${Date.now().toString(36)}`,
        attachmentKeys: attachmentSnapshotRef.current,
      });
    },
    onView: viewSentEmail,
    onSuccess: () => {
      clearDraft();
      invalidateInboxQueries();
      queryClient.invalidateQueries({
        queryKey: draftQueryKeys.list(draftSnapshotRef.current.mailboxId),
      });
      if (threadId) {
        queryClient.invalidateQueries({ queryKey: emailQueryKeys.thread(threadId) });
      }
      options?.onSent?.();
    },
    onError: (error) => {
      setSendPending(false);
      toast.error(error.message);
    },
  });

  const send = useCallback(() => {
    // Snapshot current state before triggering
    draftSnapshotRef.current = { ...draft };
    bodySnapshotRef.current = bodyRef.current;
    attachmentSnapshotRef.current =
      attachments.files.length > 0
        ? attachments.files.map((file) => ({ ...file }))
        : undefined;
    setSendPending(true);
    options?.onSent?.();
    undoSend.trigger();
  }, [draft, attachments, undoSend, options]);

  const scheduleSend = useCallback(
    async (scheduledFor: number) => {
      try {
        setSendPending(true);
        await sendEmail(
          buildEmailPayload(
            draft,
            bodyRef.current,
            threadId ?? undefined,
            attachments.files.length > 0 ? attachments.getAttachmentKeys() : undefined,
            scheduledFor,
          ),
        );
        const timeStr = new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(scheduledFor));
        clearDraft();
        queryClient.invalidateQueries({ queryKey: scheduledEmailQueryKeys.all() });
        queryClient.invalidateQueries({
          queryKey: draftQueryKeys.list(draft.mailboxId),
        });
        toast.success(`Email scheduled for ${timeStr}`);
        options?.onSent?.();
      } catch (error) {
        setSendPending(false);
        toast.error(
          error instanceof Error ? error.message : "Failed to schedule email",
        );
      }
    },
    [draft, attachments, clearDraft, queryClient, options],
  );

  const canSend = useMemo(() => {
    return mailboxId != null && to.trim().length > 0 && !sendPending;
  }, [mailboxId, sendPending, to]);

  return {
    mailboxId,
    setMailboxId,
    availableMailboxes,
    to,
    setTo,
    cc,
    setCc,
    bcc,
    setBcc,
    subject,
    setSubject,
    body,
    setBody,
    forwardedContent,
    canSend,
    send,
    scheduleSend,
    isPending: sendPending,
    attachments,
    signatures,
    selectedSignatureId,
    applySignatureById,
    templates,
    applyTemplateById,
    clearDraft,
    saveDraftNow,
    composeKey,
    loadingDraft,
  };
}
