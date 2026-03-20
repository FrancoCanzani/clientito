import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchSignature } from "../../settings/signature-queries";
import { saveDraft } from "../draft-queries";
import { useAttachmentUpload } from "../hooks/use-attachment-upload";
import { sendEmail } from "../mutations";
import type { ComposeInitial } from "./compose-email-dialog";

type UseComposeEmailOptions = {
  onSent?: () => void;
  draftId?: number;
};

function signatureToHtml(signature: string): string {
  const escaped = signature
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = escaped.split("\n").map((line) => `<p>${line || "<br>"}</p>`);
  return `<p><br></p><p>--</p>${lines.join("")}`;
}

function createComposeDraft(initial?: ComposeInitial) {
  return {
    to: initial?.to ?? "",
    cc: initial?.cc ?? "",
    subject: initial?.subject ?? "",
    body: initial?.body ?? "",
  };
}

export function getComposeInitialKey(initial?: ComposeInitial) {
  return [initial?.to ?? "", initial?.cc ?? "", initial?.subject ?? "", initial?.body ?? ""].join(
    "\u0001",
  );
}

const AUTO_SAVE_DELAY_MS = 2000;

export function useComposeEmail(
  initial?: ComposeInitial,
  options?: UseComposeEmailOptions,
) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => createComposeDraft(initial));
  const attachments = useAttachmentUpload();
  const bodyRef = useRef(draft.body);
  const signatureApplied = useRef(false);
  const [draftId, setDraftId] = useState<number | undefined>(options?.draftId);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const lastSavedRef = useRef<string>("");

  const { data: signatureData } = useQuery({
    queryKey: ["signature"],
    queryFn: fetchSignature,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (signatureApplied.current || !signatureData?.signature) return;
    signatureApplied.current = true;
    const sigHtml = signatureToHtml(signatureData.signature);

    setDraft((current) => {
      const hasExistingBody = current.body.trim().length > 0 && current.body !== "<p></p>";
      let newBody: string;
      if (!hasExistingBody) {
        // New compose - just set signature
        newBody = sigHtml;
      } else {
        // Reply/forward - insert signature before quoted content
        newBody = current.body.replace(
          /(<blockquote)/i,
          `${sigHtml}$1`,
        );
        // If no blockquote found, append at end
        if (newBody === current.body) {
          newBody = current.body + sigHtml;
        }
      }
      bodyRef.current = newBody;
      return { ...current, body: newBody };
    });
  }, [signatureData]);

  const { to, cc, subject, body } = draft;

  // Build a snapshot string for change detection
  const getSnapshot = useCallback(() => {
    return JSON.stringify({ to: draft.to, cc: draft.cc, subject: draft.subject, body: bodyRef.current });
  }, [draft.to, draft.cc, draft.subject]);

  // Auto-save logic
  const doAutoSave = useCallback(async () => {
    const snapshot = getSnapshot();
    if (snapshot === lastSavedRef.current) return;

    // Don't save empty drafts
    const hasContent =
      draft.to.trim().length > 0 ||
      draft.subject.trim().length > 0 ||
      (bodyRef.current.trim().length > 0 && bodyRef.current !== "<p></p>" && bodyRef.current !== "<p><br></p>");
    if (!hasContent) return;

    if (isSavingRef.current) return;
    isSavingRef.current = true;

    try {
      const result = await saveDraft({
        id: draftId,
        to: draft.to || undefined,
        cc: draft.cc || undefined,
        subject: draft.subject || undefined,
        body: bodyRef.current || undefined,
      });
      if (!draftId) {
        setDraftId(result.id);
      }
      lastSavedRef.current = snapshot;
    } catch {
      // Silently fail auto-save
    } finally {
      isSavingRef.current = false;
    }
  }, [draft.to, draft.cc, draft.subject, draftId, getSnapshot]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = setTimeout(() => {
      void doAutoSave();
    }, AUTO_SAVE_DELAY_MS);
  }, [doAutoSave]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, []);

  const setTo = (value: string) => {
    setDraft((current) => ({ ...current, to: value }));
    scheduleAutoSave();
  };

  const setCc = (value: string) => {
    setDraft((current) => ({ ...current, cc: value }));
    scheduleAutoSave();
  };

  const setSubject = (value: string) => {
    setDraft((current) => ({ ...current, subject: value }));
    scheduleAutoSave();
  };

  const setBody = (value: string) => {
    bodyRef.current = value;
    setDraft((current) => ({ ...current, body: value }));
    scheduleAutoSave();
  };

  const sendMutation = useMutation({
    mutationFn: () =>
      sendEmail({
        to,
        cc: cc.trim().length > 0 ? cc.trim() : undefined,
        subject,
        body: bodyRef.current,
        draftId,
        attachments:
          attachments.files.length > 0
            ? attachments.getAttachmentKeys()
            : undefined,
      }),
    onSuccess: () => {
      toast.success("Email sent");
      // Cancel any pending auto-save
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
      setDraft(createComposeDraft());
      attachments.clear();
      setDraftId(undefined);
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      void queryClient.invalidateQueries({ queryKey: ["drafts"] });
      options?.onSent?.();
    },
    onError: (error) => toast.error(error.message),
  });

  const canSend = useMemo(() => {
    const hasBody =
      body.trim().length > 0 && body !== "<p></p>" && body !== "<p><br></p>";
    return (
      to.trim().length > 0 &&
      subject.trim().length > 0 &&
      hasBody &&
      !sendMutation.isPending
    );
  }, [body, sendMutation.isPending, subject, to]);

  return {
    to,
    setTo,
    cc,
    setCc,
    subject,
    setSubject,
    body,
    setBody,
    canSend,
    sendMutation,
    attachments,
    draftId,
  };
}
