import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { unsubscribe } from "@/features/email/subscriptions/queries";
import type {
  Subscription,
  UnsubscribeResult,
} from "@/features/email/subscriptions/types";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/subscriptions");

export default function SubscriptionsPage() {
  const { subscriptions } = route.useLoaderData();
  const router = useRouter();

  return (
    <div className="flex min-h-0 w-full max-w-3xl min-w-0 flex-1 flex-col gap-4">
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
        <div className="space-y-1">
          {subscriptions.map((sub) => (
            <SubscriptionRow
              key={sub.fromAddr}
              subscription={sub}
              onUnsubscribed={() => void router.invalidate()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionRow({
  subscription,
  onUnsubscribed,
}: {
  subscription: Subscription;
  onUnsubscribed: () => void;
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
        onUnsubscribed();
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
