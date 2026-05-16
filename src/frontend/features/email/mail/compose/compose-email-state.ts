import {
  emailQueryKeys,
  draftQueryKeys,
  scheduledEmailQueryKeys,
} from "@/features/email/mail/shared/query-keys";
import {
  useMailboxes,
  type MailboxAccount,
  type MailboxTemplate,
} from "@/hooks/use-mailboxes";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useAttachmentUpload } from "@/features/email/mail/compose/use-attachment-upload";
import { loadDraft, useDraft } from "@/features/email/mail/compose/use-draft";
import { useUndoSend } from "@/features/email/mail/shared/hooks/use-undo-send";
import { createReplyReminder, sendEmail } from "@/features/email/mail/shared/mutations";
import { invalidateInboxQueries } from "@/features/email/mail/shared/data/invalidation";
import { fetchViewPage } from "@/features/email/mail/shared/data/view-pages";
import {
  buildOptimisticSentItem,
  buildOptimisticThreadItem,
  insertOptimisticIntoSentList,
  insertOptimisticIntoThread,
  makeOptimisticProviderId,
  removeOptimisticFromSentList,
  removeOptimisticFromThread,
} from "@/features/email/mail/shared/utils/optimistic-send";
import type { ComposeInitial, DraftState } from "@/features/email/mail/shared/types";
import {
  appendTemplateToBody,
  applySignatureToBody,
  combineComposeBody,
  detectInsertedSignatureId,
  splitForwardedContent,
} from "@/features/email/mail/compose/compose-body-transforms";
import { openCompose } from "@/features/email/mail/compose/compose-events";
import {
  buildTemplateContext,
  countUnresolved,
  interpolateHtml,
  interpolatePlain,
} from "@/features/email/mail/compose/template-interpolation";

type UseComposeEmailOptions = {
  onQueued?: () => void;
  onSent?: () => void;
};

type AttachmentKey = {
  key: string;
  filename: string;
  mimeType: string;
  size?: number;
  disposition?: "attachment" | "inline";
  contentId?: string;
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
    (providerMessageId === undefined ||
      typeof providerMessageId === "string") &&
    (threadId === undefined || typeof threadId === "string")
  );
}

function buildEmailPayload(
  snap: DraftState,
  bodyOverride: string,
  threadId: string | undefined,
  attachmentKeys?: AttachmentKey[],
  scheduledFor?: number,
) {
  const sendBody = replaceInlineImagePreviewSources(
    combineComposeBody(bodyOverride, snap.forwardedContent),
  );
  return {
    mailboxId: snap.mailboxId ?? undefined,
    to: snap.to,
    cc: snap.cc.trim().length > 0 ? snap.cc.trim() : undefined,
    bcc: snap.bcc.trim().length > 0 ? snap.bcc.trim() : undefined,
    subject: snap.subject,
    body: sendBody,
    threadId,
    attachments: attachmentKeys,
    ...(scheduledFor != null && { scheduledFor }),
  };
}

function replaceInlineImagePreviewSources(content: string): string {
  if (!content.includes("data-content-id")) return content;
  if (typeof DOMParser === "undefined") return content;
  const doc = new DOMParser().parseFromString(content, "text/html");
  doc.body.querySelectorAll("img[data-content-id]").forEach((image) => {
    const contentId = image.getAttribute("data-content-id");
    if (contentId) image.setAttribute("src", `cid:${contentId}`);
  });
  return doc.body.innerHTML;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getInlineAttachmentKeys(content: string): Set<string> {
  if (!content.includes("data-inline-attachment-key")) return new Set();
  if (typeof DOMParser === "undefined") return new Set();
  const doc = new DOMParser().parseFromString(content, "text/html");
  return new Set(
    Array.from(doc.body.querySelectorAll("img[data-inline-attachment-key]"))
      .map((image) => image.getAttribute("data-inline-attachment-key"))
      .filter((key): key is string => Boolean(key)),
  );
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
    attachmentKeys: initial?.attachmentKeys ?? [],
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
  const { user } = useAuth();
  const composeKey = getComposePanelKey(initial);
  // composeKey is a stable fingerprint of every `initial` field these memos
  // read — re-deriving on its change is sufficient.
  const initialDraft = useMemo(() => createComposeDraft(initial), [initial]);
  const [draft, setDraft] = useState(() => initialDraft);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const initialAttachments = useMemo(
    () =>
      (initial?.attachmentKeys ?? []).map((file) => ({
        key: file.key,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size ?? 0,
        disposition: file.disposition ?? "attachment",
        contentId: file.contentId,
      })),
    [initial?.attachmentKeys],
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

  useEffect(() => {
    const nextKeys = attachments.getAttachmentKeys();
    setDraft((current) =>
      JSON.stringify(current.attachmentKeys) === JSON.stringify(nextKeys)
        ? current
        : { ...current, attachmentKeys: nextKeys },
    );
  }, [attachments.files, attachments.getAttachmentKeys]);

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
        attachments.replaceFiles(
          (savedDraft.attachmentKeys ?? []).map((file) => ({
            key: file.key,
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size ?? 0,
            disposition: file.disposition ?? "attachment",
            contentId: file.contentId,
          })),
        );
        setDraft({
          mailboxId: savedDraft.mailboxId ?? null,
          to: savedDraft.to ?? "",
          cc: savedDraft.cc ?? "",
          bcc: savedDraft.bcc ?? "",
          subject: savedDraft.subject ?? "",
          body: savedDraft.body ?? "",
          forwardedContent: savedDraft.forwardedContent ?? "",
          attachmentKeys: savedDraft.attachmentKeys ?? [],
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
  }, [attachments.replaceFiles, composeKey, initialDraft]);

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
  const signatures = useMemo(
    () => activeMailbox?.signatures.items ?? [],
    [activeMailbox?.signatures.items],
  );
  const defaultSignatureId = activeMailbox?.signatures.defaultId ?? null;
  const templates = useMemo(
    () => activeMailbox?.templates.items ?? [],
    [activeMailbox?.templates.items],
  );

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
        ? (signatures.find((item) => item.id === defaultSignatureId) ?? null)
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
    const activeInlineKeys = getInlineAttachmentKeys(value);
    for (const file of attachments.files) {
      if (
        file.disposition === "inline" &&
        !activeInlineKeys.has(file.key)
      ) {
        attachments.removeFile(file.key);
      }
    }
    setDraft((current) => ({ ...current, body: value }));
  };

  const applySignatureById = useCallback(
    (signatureId: string | null) => {
      const signature =
        signatureId != null
          ? (signatures.find((item) => item.id === signatureId) ?? null)
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
          ? (signatures.find((item) => item.id === selectedSignatureId) ?? null)
          : null;
      const ctx = buildTemplateContext({
        to: draftRef.current.to,
        subject: draftRef.current.subject,
        fromEmail: activeMailbox?.email ?? user?.email ?? null,
        fromName: user?.name ?? null,
      });
      const interpolatedBody = interpolateHtml(template.body, ctx);
      const interpolatedSubject = interpolatePlain(template.subject, ctx);
      const interpolatedTemplate: MailboxTemplate = {
        ...template,
        body: interpolatedBody,
        subject: interpolatedSubject,
      };
      const nextBody = appendTemplateToBody(
        bodyRef.current,
        interpolatedTemplate,
        signature,
      );
      bodyRef.current = nextBody;
      setDraft((current) => ({
        ...current,
        subject: current.subject.trim() ? current.subject : interpolatedSubject,
        body: nextBody,
      }));
      const unresolved =
        countUnresolved(interpolatedBody) +
        countUnresolved(interpolatedSubject);
      if (unresolved > 0) {
        toast.info(
          `Inserted with ${unresolved} unresolved placeholder${unresolved === 1 ? "" : "s"}`,
        );
      }
    },
    [activeMailbox?.email, selectedSignatureId, signatures, templates, user],
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

  const uploadInlineImages = useCallback(
    async (files: File[]) => {
      const uploaded = (await attachments.addFiles(files, "inline")) ?? [];
      const previews = await Promise.all(files.map(fileToDataUrl));
      return uploaded.map((file, index) => ({
        src: previews[index],
        key: file.key,
        contentId: file.contentId!,
        filename: file.filename,
        mimeType: file.mimeType,
      }));
    },
    [attachments],
  );

  // Snapshot draft state at trigger time so the undo-send closure captures
  // the values that were current when the user pressed Send.
  const draftSnapshotRef = useRef(draft);
  const bodySnapshotRef = useRef(draft.body);
  const attachmentSnapshotRef = useRef<AttachmentKey[] | undefined>(undefined);
  const [replyReminderMs, setReplyReminderMs] = useState<number | null>(null);
  const replyReminderSnapshotRef = useRef<number | null>(null);
  const optimisticRef = useRef<{
    providerMessageId: string;
    mailboxId: number;
    threadId: string;
  } | null>(null);

  const clearOptimistic = useCallback(() => {
    const opt = optimisticRef.current;
    if (!opt) return;
    removeOptimisticFromSentList(queryClient, opt.mailboxId, opt.providerMessageId);
    removeOptimisticFromThread(queryClient, opt.threadId, opt.providerMessageId);
    optimisticRef.current = null;
  }, [queryClient]);

  const undoSend = useUndoSend({
    onSend: async () => {
      const sentAt = Date.now();
      const result = await sendEmail(
        buildEmailPayload(
          draftSnapshotRef.current,
          bodySnapshotRef.current,
          threadId ?? undefined,
          attachmentSnapshotRef.current,
        ),
      );

      const reminderMs = replyReminderSnapshotRef.current;
      const mailboxIdSnapshot = draftSnapshotRef.current.mailboxId;
      if (
        reminderMs &&
        result.threadId &&
        result.providerMessageId &&
        mailboxIdSnapshot != null
      ) {
        try {
          await createReplyReminder({
            mailboxId: mailboxIdSnapshot,
            threadId: result.threadId,
            sentMessageId: result.providerMessageId,
            sentAt,
            durationMs: reminderMs,
          });
        } catch (error) {
          console.warn("Failed to register reply reminder", error);
          toast.error("Email sent, but reply reminder could not be set");
        }
      }

      return result;
    },
    onUndo: () => {
      clearOptimistic();
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
      clearOptimistic();
      clearDraft();
      invalidateInboxQueries();
      queryClient.invalidateQueries({
        queryKey: draftQueryKeys.list(draftSnapshotRef.current.mailboxId),
      });
      if (threadId) {
        queryClient.invalidateQueries({
          queryKey: emailQueryKeys.thread(threadId),
        });
      }
      options?.onSent?.();
    },
    onError: (error) => {
      clearOptimistic();
      setSendPending(false);
      toast.error(error.message);
    },
  });

  const send = useCallback(() => {
    draftSnapshotRef.current = { ...draft };
    bodySnapshotRef.current = bodyRef.current;
    attachmentSnapshotRef.current =
      attachments.files.length > 0
        ? attachments.files.map((file) => ({ ...file }))
        : undefined;
    replyReminderSnapshotRef.current = replyReminderMs;

    const snapshot = draftSnapshotRef.current;
    if (snapshot.mailboxId != null && activeMailbox) {
      const providerMessageId = makeOptimisticProviderId();
      const fromAddr =
        activeMailbox.email ?? activeMailbox.gmailEmail ?? user?.email ?? "";
      const fromName = user?.name ?? null;
      const combinedBody = combineComposeBody(
        bodySnapshotRef.current,
        snapshot.forwardedContent,
      );
      const item = buildOptimisticSentItem(
        {
          mailboxId: snapshot.mailboxId,
          fromAddr,
          fromName,
          to: snapshot.to,
          cc: snapshot.cc,
          bcc: snapshot.bcc,
          subject: snapshot.subject,
          body: combinedBody,
          threadId: threadId ?? undefined,
          hasAttachment: (attachmentSnapshotRef.current?.length ?? 0) > 0,
        },
        providerMessageId,
      );
      const threadItem = buildOptimisticThreadItem(
        {
          mailboxId: snapshot.mailboxId,
          fromAddr,
          fromName,
          to: snapshot.to,
          cc: snapshot.cc,
          bcc: snapshot.bcc,
          subject: snapshot.subject,
          body: combinedBody,
          threadId: threadId ?? undefined,
          hasAttachment: (attachmentSnapshotRef.current?.length ?? 0) > 0,
        },
        item,
      );
      insertOptimisticIntoSentList(queryClient, snapshot.mailboxId, item);
      insertOptimisticIntoThread(queryClient, item.threadId ?? "", threadItem);
      optimisticRef.current = {
        providerMessageId,
        mailboxId: snapshot.mailboxId,
        threadId: item.threadId ?? "",
      };
    }

    setSendPending(true);
    options?.onQueued?.();
    undoSend.trigger();
  }, [
    activeMailbox,
    attachments,
    uploadInlineImages,
    draft,
    options,
    queryClient,
    replyReminderMs,
    threadId,
    undoSend,
    user?.email,
    user?.name,
  ]);

  const scheduleSend = useCallback(
    async (scheduledFor: number) => {
      try {
        setSendPending(true);
        await sendEmail(
          buildEmailPayload(
            draft,
            bodyRef.current,
            threadId ?? undefined,
            attachments.files.length > 0
              ? attachments.getAttachmentKeys()
              : undefined,
            scheduledFor,
          ),
        );
        const timeStr = new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(scheduledFor));
        clearDraft();
        queryClient.invalidateQueries({
          queryKey: scheduledEmailQueryKeys.all(),
        });
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
    [draft, attachments, clearDraft, queryClient, options, threadId],
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
    replyReminderMs,
    setReplyReminderMs,
    isPending: sendPending,
    attachments,
    uploadInlineImages,
    signatures,
    selectedSignatureId,
    applySignatureById,
    templates,
    applyTemplateById,
    clearDraft,
    composeKey,
    loadingDraft,
    draftStatus: serverDraft.status,
    draftLastSavedAt: serverDraft.lastSavedAt,
  };
}
