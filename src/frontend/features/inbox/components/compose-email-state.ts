import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useMailboxes, type MailboxAccount } from "@/hooks/use-mailboxes";
import { useAttachmentUpload } from "../hooks/use-attachment-upload";
import { sendEmail } from "../mutations";
import type { ComposeInitial } from "./compose-email-dialog";

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
  const [draft, setDraft] = useState(() => createComposeDraft(initial));
  const attachments = useAttachmentUpload();
  const bodyRef = useRef(draft.body);

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
    setDraft((current) => ({ ...current, mailboxId: availableMailboxes[0].mailboxId }));
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

  const sendMutation = useMutation({
    mutationFn: () =>
      sendEmail({
        mailboxId: draft.mailboxId ?? undefined,
        to,
        cc: cc.trim().length > 0 ? cc.trim() : undefined,
        bcc: bcc.trim().length > 0 ? bcc.trim() : undefined,
        subject,
        body: bodyRef.current,
        attachments:
          attachments.files.length > 0
            ? attachments.getAttachmentKeys()
            : undefined,
      }),
    onSuccess: () => {
      toast.success("Email sent");
      setDraft(createComposeDraft());
      attachments.clear();
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      options?.onSent?.();
    },
    onError: (error) => toast.error(error.message),
  });

  const canSend = useMemo(() => {
    const hasBody =
      body.trim().length > 0 && body !== "<p></p>" && body !== "<p><br></p>";
    return (
      mailboxId != null &&
      to.trim().length > 0 &&
      subject.trim().length > 0 &&
      hasBody &&
      !sendMutation.isPending
    );
  }, [body, mailboxId, sendMutation.isPending, subject, to]);

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
    sendMutation,
    attachments,
  };
}
