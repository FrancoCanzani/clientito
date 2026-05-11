import { PageSpinner } from "@/components/page-spinner";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import {
  MailboxPage,
  MailboxPageBody,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
import {
  useBlockSender,
  useSubscriptionSenders,
  useUnsubscribe,
} from "@/features/email/subscriptions/queries";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";

const subscriptionsRoute = getRouteApi("/_dashboard/$mailboxId/subscriptions");

export default function SubscriptionsPage() {
  const { mailboxId } = subscriptionsRoute.useParams();
  const sendersQuery = useSubscriptionSenders(mailboxId);
  const unsubscribeMut = useUnsubscribe(mailboxId);
  const blockMut = useBlockSender(mailboxId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unsubscribeTarget, setUnsubscribeTarget] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const sorted = useMemo(
    () =>
      [...(sendersQuery.data ?? [])].sort(
        (a, b) => b.latestDate - a.latestDate,
      ),
    [sendersQuery.data],
  );

  const allSelected =
    sorted.length > 0 &&
    sorted.every((s) => selected.has(s.fromAddr.toLowerCase()));
  const someSelected = selected.size > 0;

  function toggleSender(addr: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = addr.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((s) => s.fromAddr.toLowerCase())));
    }
  }

  const pendingAddr = (unsubscribeMut.isPending
    ? unsubscribeMut.variables?.fromAddr
    : blockMut.isPending
      ? blockMut.variables?.fromAddr
      : null
  )?.toLowerCase();

  const headerActions = sorted.length > 0
    ? [
        someSelected && (
          <span key="count" className="text-xs text-muted-foreground">
            {selected.size} selected
          </span>
        ),
        <Button key="toggle" size="sm" variant="outline" onClick={toggleAll}>
          {allSelected ? "Deselect all" : "Select all"}
        </Button>,
        someSelected && (
          <Button
            key="bulk"
            size="sm"
            variant="outline"
            onClick={() => setBulkOpen(true)}
          >
            Unsubscribe selected
          </Button>
        ),
      ].filter(Boolean)
    : undefined;

  return (
    <MailboxPage className="max-w-none">
      <MailboxPageHeader title="Subscriptions" actions={headerActions} />
      <MailboxPageBody className="overflow-y-auto">
        <div className="w-full px-4 pb-3">
          {sendersQuery.isLoading ? (
            <PageSpinner />
          ) : sorted.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No subscriptions</EmptyTitle>
                <EmptyDescription>
                  Newsletters and mailing lists you&apos;re subscribed to will
                  appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y divide-border/40">
              {sorted.map((sender) => {
                const addr = sender.fromAddr.toLowerCase();
                const isSelected = selected.has(addr);
                const busy = pendingAddr === addr;

                return (
                  <div key={addr} className="flex items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSender(addr)}
                      className="size-3.5 shrink-0 accent-primary"
                    />
                    <div className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-medium">
                        {sender.fromName ?? sender.fromAddr}
                      </span>
                      {sender.fromName && (
                        <span className="text-muted-foreground">
                          {" "}
                          &lt;{sender.fromAddr}&gt;
                        </span>
                      )}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {sender.emailCount === 1
                          ? "1 email"
                          : `${sender.emailCount} emails`}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setUnsubscribeTarget(sender.fromAddr)}
                      >
                        Unsubscribe
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => setBlockTarget(sender.fromAddr)}
                      >
                        Block
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </MailboxPageBody>

      <AlertDialog
        open={unsubscribeTarget !== null}
        onOpenChange={(open) => !open && setUnsubscribeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Unsubscribe from {unsubscribeTarget}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll be removed from this mailing list. Existing emails
              from {unsubscribeTarget} will also be moved to Archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const sender = sorted.find(
                  (s) => s.fromAddr === unsubscribeTarget,
                );
                if (sender) {
                  unsubscribeMut.mutate({
                    fromAddr: sender.fromAddr,
                    unsubscribeUrl: sender.unsubscribeUrl ?? undefined,
                    unsubscribeEmail: sender.unsubscribeEmail ?? undefined,
                  });
                }
                setUnsubscribeTarget(null);
              }}
            >
              Unsubscribe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={blockTarget !== null}
        onOpenChange={(open) => !open && setBlockTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {blockTarget}?</AlertDialogTitle>
            <AlertDialogDescription>
              Future emails from {blockTarget} will be sent to Trash. Existing
              emails from this sender will also be moved to Trash. You can undo
              this in Gmail Settings &rarr; Filters.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                blockMut.mutate({
                  fromAddr: blockTarget!,
                  mailboxId,
                });
                setBlockTarget(null);
              }}
            >
              Block sender
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Unsubscribe from {selected.size}{" "}
              {selected.size === 1 ? "sender" : "senders"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll be removed from each mailing list. Existing emails
              will also be moved to Archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                for (const sender of sorted) {
                  if (selected.has(sender.fromAddr.toLowerCase())) {
                    unsubscribeMut.mutate({
                      fromAddr: sender.fromAddr,
                      unsubscribeUrl: sender.unsubscribeUrl ?? undefined,
                      unsubscribeEmail: sender.unsubscribeEmail ?? undefined,
                    });
                  }
                }
                setSelected(new Set());
                setBulkOpen(false);
              }}
            >
              Unsubscribe {selected.size}{" "}
              {selected.size === 1 ? "sender" : "senders"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MailboxPage>
  );
}