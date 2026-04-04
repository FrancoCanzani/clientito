import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { unsubscribe } from "@/features/subscriptions/queries";
import type {
  Subscription,
  UnsubscribeResult,
} from "@/features/subscriptions/types";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/subscriptions");

export default function SubscriptionsPage() {
  const { subscriptions } = route.useLoaderData();
  const [items, setItems] = useState(subscriptions);

  useEffect(() => {
    setItems(subscriptions);
  }, [subscriptions]);

  return (
    <div className="flex min-h-0 w-full max-w-3xl min-w-0 flex-1 flex-col gap-4">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="h-10 w-10 md:hidden [&>svg]:size-5" />
            <span>Subscriptions</span>
          </div>
        }
      />
      {items.length === 0 ? (
        <Empty className="min-h-0 flex-1 border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>No subscriptions found</EmptyTitle>
            <EmptyDescription>
              Unsubscribe data is collected as new emails arrive.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-1">
          {items.map((sub) => (
            <SubscriptionRow
              key={sub.fromAddr}
              subscription={sub}
              onRemove={(fromAddr) =>
                setItems((current) =>
                  current.filter((item) => item.fromAddr !== fromAddr),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionRow({
  subscription,
  onRemove,
}: {
  subscription: Subscription;
  onRemove: (fromAddr: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "manual">(
    subscription.status === "pending_manual" ? "manual" : "idle",
  );
  const [manualUrl, setManualUrl] = useState<string | null>(
    subscription.status === "pending_manual"
      ? subscription.unsubscribeUrl
      : null,
  );

  const handleUnsubscribe = async () => {
    setStatus("loading");
    try {
      const result: UnsubscribeResult = await unsubscribe({
        fromAddr: subscription.fromAddr,
        unsubscribeUrl: subscription.unsubscribeUrl ?? undefined,
        unsubscribeEmail: subscription.unsubscribeEmail ?? undefined,
      });

      if (result.success) {
        setStatus("done");
        toast(
          "Unsubscribed from " +
            (subscription.fromName ?? subscription.fromAddr),
        );
        onRemove(subscription.fromAddr);
      } else if (result.method === "manual" && result.url) {
        setStatus("manual");
        setManualUrl(result.url);
        window.open(result.url, "_blank", "noopener");
      }
    } catch {
      setStatus("idle");
      toast.error("Failed to unsubscribe");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/40">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {subscription.fromName ?? subscription.fromAddr}
        </div>
        {subscription.fromName && (
          <div className="truncate text-xs text-muted-foreground">
            {subscription.fromAddr}
          </div>
        )}
      </div>

      <span className="shrink-0 text-xs text-muted-foreground">
        {subscription.emailCount} email{subscription.emailCount !== 1 && "s"}
      </span>

      {status === "done" ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          Unsubscribed
        </span>
      ) : status === "manual" && manualUrl ? (
        <a
          href={manualUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs underline"
        >
          Complete manually
        </a>
      ) : (
        <button
          type="button"
          disabled={status === "loading"}
          onClick={handleUnsubscribe}
          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
        >
          {status === "loading" ? "..." : "Unsubscribe"}
        </button>
      )}
    </div>
  );
}
