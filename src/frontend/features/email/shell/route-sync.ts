import { enqueueActiveViewSync } from "@/features/email/mail/queries";

export function enqueueMailboxRouteViewSync({
  mailboxId,
  view,
  preload,
}: {
  mailboxId: number;
  view: string;
  preload: boolean;
}) {
  if (preload) return;
  void enqueueActiveViewSync({ mailboxId, view });
}
