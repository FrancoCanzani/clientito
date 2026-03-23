import { useMailboxes, type MailboxAccount } from "@/hooks/use-mailboxes";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAttachmentUpload } from "../hooks/use-attachment-upload";
import { useLocalDraft } from "../hooks/use-local-draft";
import { useUndoSend } from "../hooks/use-undo-send";
import { sendEmail } from "../mutations";
import type { ComposeInitial } from "../types";

type UseComposeEmailOptions = {
  onSent?: () => void;
};

type ComposeDraft = {
  mailboxId: number | null;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  forwardedContent: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPlainForwardedHtml(content: string) {
  return [
    '<div data-forwarded-message="true" style="border-top:1px solid #dadce0;margin-top:16px;padding-top:16px;color:#5f6368;font-size:13px">',
    '<div data-forwarded-original-body="true" style="white-space:pre-wrap">',
    escapeHtml(content),
    "</div>",
    "</div>",
  ].join("");
}

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

export function getComposeInitialKey(initial?: ComposeInitial) {
  return [
    initial?.mailboxId ?? "",
    initial?.to ?? "",
    initial?.cc ?? "",
    initial?.bcc ?? "",
    initial?.subject ?? "",
    initial?.body ?? "",
    initial?.bodyHtml ?? "",
  ].join("\u0001");
}

export function useComposeEmail(
  initial?: ComposeInitial,
  options?: UseComposeEmailOptions,
) {
  const queryClient = useQueryClient();
  const mailboxesQuery = useMailboxes();
  const composeKey = getComposeInitialKey(initial);
  const [draft, setDraft] = useState(() => {
    const saved = useLocalDraft.load(composeKey);
    if (!saved) {
      return createComposeDraft(initial);
    }

    const normalizedSaved = saved as Partial<ComposeDraft>;
    if (typeof normalizedSaved.forwardedContent === "string") {
      return {
        mailboxId: normalizedSaved.mailboxId ?? null,
        to: normalizedSaved.to ?? "",
        cc: normalizedSaved.cc ?? "",
        bcc: normalizedSaved.bcc ?? "",
        subject: normalizedSaved.subject ?? "",
        body: normalizedSaved.body ?? "",
        forwardedContent: normalizedSaved.forwardedContent,
      } satisfies ComposeDraft;
    }

    const split = splitForwardedContent(normalizedSaved.body ?? "");
    return {
      mailboxId: normalizedSaved.mailboxId ?? null,
      to: normalizedSaved.to ?? "",
      cc: normalizedSaved.cc ?? "",
      bcc: normalizedSaved.bcc ?? "",
      subject: normalizedSaved.subject ?? "",
      body: split.body,
      forwardedContent: split.forwardedContent,
    } satisfies ComposeDraft;
  });
  const { clearDraft } = useLocalDraft(composeKey, draft);
  const attachments = useAttachmentUpload();
  const bodyRef = useRef(draft.body);
  const [sendPending, setSendPending] = useState(false);

  const { mailboxId, to, cc, bcc, subject, body, forwardedContent } = draft;
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

  // Snapshot draft state at trigger time so the undo-send closure captures
  // the values that were current when the user pressed Send.
  const draftSnapshotRef = useRef(draft);
  const attachmentSnapshotRef = useRef<
    ReturnType<typeof attachments.getAttachmentKeys> | undefined
  >(undefined);

  const undoSend = useUndoSend({
    onSend: () => {
      const snap = draftSnapshotRef.current;
      const attSnap = attachmentSnapshotRef.current;
      return sendEmail({
        mailboxId: snap.mailboxId ?? undefined,
        to: snap.to,
        cc: snap.cc.trim().length > 0 ? snap.cc.trim() : undefined,
        bcc: snap.bcc.trim().length > 0 ? snap.bcc.trim() : undefined,
        subject: snap.subject,
        body: combineComposeBody(bodyRef.current, snap.forwardedContent),
        attachments: attSnap,
      });
    },
    onSuccess: () => {
      clearDraft();
      toast.success("Email sent");
      setSendPending(false);
      setDraft(createComposeDraft());
      attachments.clear();
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
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
    isPending: sendPending,
    attachments,
    clearDraft,
  };
}
