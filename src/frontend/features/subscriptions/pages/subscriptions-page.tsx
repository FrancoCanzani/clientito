import { unsubscribe } from "@/features/subscriptions/queries";
import type { Subscription, UnsubscribeResult } from "@/features/subscriptions/types";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

const route = getRouteApi("/_dashboard/inbox/subscriptions");

export default function SubscriptionsPage() {
  const { subscriptions } = route.useLoaderData();

  if (subscriptions.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 py-4">
        <h2 className="text-lg font-medium">Subscriptions</h2>
        <p className="text-sm text-muted-foreground">
          No subscriptions found. Unsubscribe data is collected as new emails
          arrive.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-4">
      <header>
        <h2 className="text-lg font-medium">Subscriptions</h2>
        <p className="text-sm text-muted-foreground">
          {subscriptions.length} subscription{subscriptions.length !== 1 && "s"}{" "}
          detected
        </p>
      </header>

      <div className="space-y-1">
        {subscriptions.map((sub) => (
          <SubscriptionRow key={sub.fromAddr} subscription={sub} />
        ))}
      </div>
    </div>
  );
}

function SubscriptionRow({ subscription }: { subscription: Subscription }) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "done" | "manual"
  >("idle");
  const [manualUrl, setManualUrl] = useState<string | null>(null);

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
        toast("Unsubscribed from " + (subscription.fromName ?? subscription.fromAddr));
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
