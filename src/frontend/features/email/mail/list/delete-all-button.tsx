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
import {
  deleteAllForever,
  sanitizeMutationError,
} from "@/features/email/mail/mutations";
import { invalidateInboxQueries } from "@/features/email/mail/data/invalidation";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type { EmailListPage } from "@/features/email/mail/types";
import { removeIdsFromInfiniteData } from "@/features/email/mail/utils/optimistic-mail-state";
import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const all = await fetchAllLocalViewEmails({ mailboxId, view: folder });
      const providerIds = all.emails.map((e) => e.providerMessageId);
      const idSet = new Set(all.emails.map((e) => e.id));
      if (!providerIds.length) return { providerIds: [] as string[], idSet };

      queryClient.setQueriesData<InfiniteData<EmailListPage> | undefined>(
        { queryKey: emailQueryKeys.list(folder, mailboxId) },
        (current) => removeIdsFromInfiniteData(current, idSet),
      );

      try {
        await deleteAllForever({ mailboxId, providerMessageIds: providerIds });
        await localDb.deleteEmailsByProviderMessageId(providerIds, {
          mailboxId,
        });
        return { providerIds, idSet };
      } catch (error) {
        invalidateInboxQueries();
        throw error;
      }
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
      const { message } = sanitizeMutationError(err, "Failed to delete messages");
      toast.error(message);
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
