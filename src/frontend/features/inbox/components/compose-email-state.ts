import { useMailboxes, type MailboxAccount } from "@/hooks/use-mailboxes";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAttachmentUpload } from "../hooks/use-attachment-upload";
import { useLocalDraft } from "../hooks/use-local-draft";
import { useUndoSend } from "../hooks/use-undo-send";
import { sendEmail } from "../mutations";
import type { ComposeInitial } from "./compose-email-fields";

type UseComposeEmailOptions = {
  onSent?: () => void;
};

function createComposeDraft(initial?: ComposeInitial) {
  return {
    mailboxId: initial?.mailboxId ?? null,
    to: initial?.to ?? "",
    cc: initial?.cc ?? "",
    bcc: initial?.bcc ?? "",
    subject: initial?.subject ?? "",
    body: initial?.body ?? "",
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
    return saved ?? createComposeDraft(initial);
  });
  const { clearDraft } = useLocalDraft(composeKey, draft);
  const attachments = useAttachmentUpload();
  const bodyRef = useRef(draft.body);
  const [sendPending, setSendPending] = useState(false);

  const { mailboxId, to, cc, bcc, subject, body } = draft;
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
        body: bodyRef.current,
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
    const hasBody =
      body.trim().length > 0 && body !== "<p></p>" && body !== "<p><br></p>";
    return mailboxId != null && to.trim().length > 0 && hasBody && !sendPending;
  }, [body, mailboxId, sendPending, subject, to]);

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
    canSend,
    send,
    isPending: sendPending,
    attachments,
    clearDraft,
  };
}
