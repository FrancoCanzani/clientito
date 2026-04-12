import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import {
  bulkUnsubscribe,
  fetchSuggestions,
  unsubscribe,
} from "@/features/email/subscriptions/queries";
import type {
  Subscription,
  SubscriptionSuggestions,
  UnsubscribeResult,
} from "@/features/email/subscriptions/types";
import { queryKeys } from "@/lib/query-keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/subscriptions");

const CONFIRM_DISMISSED_KEY = "petit:unsub-confirm-dismissed";

export default function SubscriptionsPage() {
  const { subscriptions } = route.useLoaderData();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: suggestions } = useQuery<SubscriptionSuggestions>({
    queryKey: queryKeys.subscriptionSuggestions(),
    queryFn: fetchSuggestions,
    staleTime: 60_000,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [trashOnUnsub, setTrashOnUnsub] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<Subscription | null>(null);
  const [skipConfirm, setSkipConfirm] = useState(
    () => localStorage.getItem(CONFIRM_DISMISSED_KEY) === "true",
  );

  useEffect(() => {
    localStorage.setItem(CONFIRM_DISMISSED_KEY, String(skipConfirm));
  }, [skipConfirm]);

  const invalidateSubscriptions = useCallback(() => {
    void router.invalidate();
    void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions() });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.subscriptionSuggestions(),
    });
  }, [router, queryClient]);

  const toggleSelect = useCallback((fromAddr: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fromAddr)) next.delete(fromAddr);
      else next.add(fromAddr);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === subscriptions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(subscriptions.map((s) => s.fromAddr)));
    }
  }, [selected.size, subscriptions]);

  const handleUnsubscribe = useCallback(
    async (sub: Subscription) => {
      if (!skipConfirm) {
        setConfirmTarget(sub);
        return;
      }
      await executeUnsubscribe(sub);
    },
    [skipConfirm, trashOnUnsub],
  );

  const executeUnsubscribe = async (sub: Subscription) => {
    try {
      const result: UnsubscribeResult = await unsubscribe({
        fromAddr: sub.fromAddr,
        unsubscribeUrl: sub.unsubscribeUrl ?? undefined,
        unsubscribeEmail: sub.unsubscribeEmail ?? undefined,
        trashExisting: trashOnUnsub,
      });

      if (result.success) {
        const trashedMsg =
          result.trashedCount && result.trashedCount > 0
            ? ` · ${result.trashedCount} emails trashed`
            : "";
        toast(`Unsubscribed from ${sub.fromName ?? sub.fromAddr}${trashedMsg}`);
        invalidateSubscriptions();
      } else if (result.method === "manual" && result.url) {
        toast("Opening manual unsubscribe page...");
        window.open(result.url, "_blank", "noopener");
      }
    } catch {
      toast.error("Failed to unsubscribe");
    }
  };

  const handleBulkUnsubscribe = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const items = subscriptions
        .filter((s) => selected.has(s.fromAddr))
        .map((s) => ({
          fromAddr: s.fromAddr,
          unsubscribeUrl: s.unsubscribeUrl ?? undefined,
          unsubscribeEmail: s.unsubscribeEmail ?? undefined,
        }));

      const result = await bulkUnsubscribe({
        items,
        trashExisting: trashOnUnsub,
      });

      const succeeded = result.results.filter((r) => r.success).length;
      const failed = result.results.filter((r) => !r.success).length;
      const trashedMsg =
        result.trashedCount > 0
          ? ` · ${result.trashedCount} emails trashed`
          : "";

      if (succeeded > 0) {
        toast(`Unsubscribed from ${succeeded} sender${succeeded !== 1 ? "s" : ""}${trashedMsg}`);
      }
      if (failed > 0) {
        toast.warning(
          `${failed} sender${failed !== 1 ? "s" : ""} need manual unsubscription`,
        );
      }

      setSelected(new Set());
      invalidateSubscriptions();
    } catch {
      toast.error("Bulk unsubscribe failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const topSenders = suggestions?.topSenders ?? [];

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span>Subscriptions</span>
          </div>
        }
      />

      {subscriptions.length === 0 ? (
        <Empty className="min-h-0 flex-1 border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>No subscriptions found</EmptyTitle>
            <EmptyDescription>
              Unsubscribe data is collected as new emails arrive.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {/* Top offenders */}
          {topSenders.length > 0 && (
            <section className="space-y-1">
              <p className="px-2 text-xs text-muted-foreground">
                Most frequent
              </p>
              <div className="rounded-md border border-border/40 p-0.5">
                {topSenders.slice(0, 5).map((sub) => (
                  <div
                    key={sub.fromAddr}
                    className="flex items-center gap-3 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {sub.fromName ?? sub.fromAddr}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {sub.emailCount} email
                      {sub.emailCount !== 1 && "s"}
                    </span>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        handleUnsubscribe(sub as Subscription)
                      }
                    >
                      Unsubscribe
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Toolbar — single row */}
          <div className="flex items-center gap-3 px-2">
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {selected.size === subscriptions.length
                ? "Deselect all"
                : selected.size > 0
                  ? `${selected.size} selected`
                  : "Select all"}
            </button>

            {selected.size > 0 && (
              <Button
                size="xs"
                variant="outline"
                disabled={bulkLoading}
                onClick={handleBulkUnsubscribe}
              >
                {bulkLoading
                  ? "Unsubscribing..."
                  : `Unsubscribe (${selected.size})`}
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground">
              {subscriptions.length} total
            </span>

            <label
              htmlFor="trash-toggle"
              className="cursor-pointer text-xs text-muted-foreground"
            >
              Trash old emails
            </label>
            <Switch
              id="trash-toggle"
              checked={trashOnUnsub}
              onCheckedChange={setTrashOnUnsub}
            />
          </div>

          {/* Subscription list */}
          <div className="space-y-0.5">
            {subscriptions.map((sub) => (
              <SubscriptionRow
                key={sub.fromAddr}
                subscription={sub}
                selected={selected.has(sub.fromAddr)}
                onToggleSelect={() => toggleSelect(sub.fromAddr)}
                onUnsubscribe={() => handleUnsubscribe(sub)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {confirmTarget && (
        <ConfirmUnsubscribeModal
          subscription={confirmTarget}
          trashExisting={trashOnUnsub}
          onConfirm={async () => {
            const sub = confirmTarget;
            setConfirmTarget(null);
            await executeUnsubscribe(sub);
          }}
          onCancel={() => setConfirmTarget(null)}
          skipConfirm={skipConfirm}
          onSkipConfirmChange={setSkipConfirm}
        />
      )}
    </div>
  );
}

function SubscriptionRow({
  subscription,
  selected,
  onToggleSelect,
  onUnsubscribe,
}: {
  subscription: Subscription;
  selected: boolean;
  onToggleSelect: () => void;
  onUnsubscribe: () => void;
}) {
  const isPendingManual = subscription.status === "pending_manual";

  return (
    <div
      className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/40 ${selected ? "bg-muted/30" : ""}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="size-3.5 rounded border-border accent-primary"
      />

      <span className="min-w-0 flex-1 truncate">
        {subscription.fromName ?? subscription.fromAddr}
      </span>

      {subscription.fromName && (
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          {subscription.fromAddr}
        </span>
      )}

      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {subscription.emailCount}
      </span>

      {isPendingManual && subscription.unsubscribeUrl ? (
        <a
          href={subscription.unsubscribeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-muted-foreground underline"
        >
          Complete manually
        </a>
      ) : (
        <Button size="xs" variant="ghost" onClick={onUnsubscribe}>
          Unsubscribe
        </Button>
      )}
    </div>
  );
}

function ConfirmUnsubscribeModal({
  subscription,
  trashExisting,
  onConfirm,
  onCancel,
  skipConfirm,
  onSkipConfirmChange,
}: {
  subscription: Subscription;
  trashExisting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  skipConfirm: boolean;
  onSkipConfirmChange: (value: boolean) => void;
}) {
  const senderName = subscription.fromName ?? subscription.fromAddr;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <div className="relative mx-4 w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-5 shadow-lg">
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">Confirm unsubscribe</h3>
          <p className="text-xs text-muted-foreground">
            Unsubscribe from{" "}
            <span className="font-medium text-foreground">{senderName}</span>?
            {trashExisting &&
              " All existing emails from this sender will also be trashed."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="skip-confirm"
            type="checkbox"
            checked={skipConfirm}
            onChange={(e) => onSkipConfirmChange(e.target.checked)}
            className="size-3.5 rounded border-border accent-primary"
          />
          <label
            htmlFor="skip-confirm"
            className="cursor-pointer text-xs text-muted-foreground"
          >
            Don't ask again
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={onConfirm}>
            Unsubscribe
          </Button>
        </div>
      </div>
    </div>
  );
}
