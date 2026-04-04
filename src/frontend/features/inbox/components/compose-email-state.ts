import { useMailboxes, type MailboxAccount } from "@/hooks/use-mailboxes";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAttachmentUpload } from "../hooks/use-attachment-upload";
import { loadDraft, useDraft } from "../hooks/use-draft";
import { useUndoSend } from "../hooks/use-undo-send";
import { sendEmail } from "../mutations";
import { getDraftsQueryKey } from "../queries/drafts";
import type { ComposeInitial, DraftState } from "../types";
import { buildPlainForwardedHtml } from "../utils/build-forwarded-html";

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

type AttachmentKey = { key: string; filename: string; mimeType: string };

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
  const mailboxesQuery = useMailboxes();
  const composeKey = getComposePanelKey(initial);
  const [draft, setDraft] = useState(() => createComposeDraft(initial));
  const [loadingDraft, setLoadingDraft] = useState(true);
  const attachments = useAttachmentUpload();
  const bodyRef = useRef(draft.body);
  const [sendPending, setSendPending] = useState(false);

  const threadId = initial?.threadId;
  const { mailboxId, to, cc, bcc, subject, body, forwardedContent } = draft;

  useEffect(() => {
    let cancelled = false;

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
        const nextDraft = createComposeDraft(initial);
        setDraft(nextDraft);
        bodyRef.current = nextDraft.body;
      }

      setLoadingDraft(false);
    });

    return () => {
      cancelled = true;
    };
  }, [composeKey, initial]);

  const serverDraft = useDraft(composeKey, draft);
  const availableMailboxes = useMemo(
    () =>
      (mailboxesQuery.data?.accounts ?? []).filter(
        (account): account is MailboxAccount & { mailboxId: number } =>
          account.mailboxId != null,
      ),
    [mailboxesQuery.data?.accounts],
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

  const setMailboxId = (value: number) => {
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

  const clearDraft = useCallback(async () => {
    await serverDraft.clearDraft();
    const nextDraft = createComposeDraft(initial);
    bodyRef.current = nextDraft.body;
    attachments.clear();
    setSendPending(false);
    setDraft(nextDraft);
  }, [attachments, initial, serverDraft]);

  // Snapshot draft state at trigger time so the undo-send closure captures
  // the values that were current when the user pressed Send.
  const draftSnapshotRef = useRef(draft);
  const attachmentSnapshotRef = useRef<
    ReturnType<typeof attachments.getAttachmentKeys> | undefined
  >(undefined);

  const undoSend = useUndoSend({
    onSend: () => {
      return sendEmail(
        buildEmailPayload(
          draftSnapshotRef.current,
          bodyRef.current,
          threadId ?? undefined,
          attachmentSnapshotRef.current,
        ),
      );
    },
    onSuccess: () => {
      clearDraft();
      toast.success("Email sent");
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({
        queryKey: getDraftsQueryKey(draftSnapshotRef.current.mailboxId),
      });
      if (threadId) {
        queryClient.invalidateQueries({ queryKey: ["email-thread", threadId] });
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
    attachmentSnapshotRef.current =
      attachments.files.length > 0
        ? attachments.getAttachmentKeys()
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
        queryClient.invalidateQueries({ queryKey: ["scheduled-emails"] });
        queryClient.invalidateQueries({
          queryKey: getDraftsQueryKey(draft.mailboxId),
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
    const hasDraftBody =
      body.trim().length > 0 && body !== "<p></p>" && body !== "<p><br></p>";
    const hasBody = hasDraftBody || forwardedContent.trim().length > 0;
    return mailboxId != null && to.trim().length > 0 && hasBody && !sendPending;
  }, [body, forwardedContent, mailboxId, sendPending, subject, to]);

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
    clearDraft,
    loadingDraft,
  };
}
