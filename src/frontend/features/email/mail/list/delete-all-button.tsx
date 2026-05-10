import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { localDb } from "@/db/client";
import { fetchAllLocalViewEmails } from "@/features/email/mail/data/view-pages";
import { deleteAllForever } from "@/features/email/mail/mutations";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export function DeleteAllButton({
  folder,
  mailboxId,
  onDeleted,
}: {
  folder: "spam" | "trash";
  mailboxId: number;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const all = await fetchAllLocalViewEmails({ mailboxId, view: folder });
      const ids = all.emails.map((e) => e.providerMessageId);
      if (!ids.length) return;
      await deleteAllForever({ mailboxId, providerMessageIds: ids });
      await localDb.deleteEmailsByProviderMessageId(ids);
    },
    onSuccess: () => {
      toast.success(
        folder === "spam"
          ? "All spam messages deleted"
          : "All trash messages deleted",
      );
      setOpen(false);
      onDeleted();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete messages");
    },
  });

  const label = folder === "spam" ? "Delete all spam" : "Delete all trash";

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {folder === "spam"
                ? "Delete all spam messages?"
                : "Delete all trash messages?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all messages in {folder}. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Deleting…" : "Delete all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
