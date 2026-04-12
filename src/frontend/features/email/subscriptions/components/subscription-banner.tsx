import { Button } from "@/components/ui/button";
import {
  fetchSubscriptions,
  unsubscribe,
} from "@/features/email/subscriptions/queries";
import type { Subscription } from "@/features/email/subscriptions/types";
import { queryKeys } from "@/lib/query-keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export function SubscriptionBanner({
  fromAddr,
  fromName,
}: {
  fromAddr: string;
  fromName: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  const { data: subscriptions } = useQuery<Subscription[]>({
    queryKey: queryKeys.subscriptions(),
    queryFn: fetchSubscriptions,
    staleTime: 60_000,
  });

  const match = subscriptions?.find(
    (s) => s.fromAddr.toLowerCase() === fromAddr.toLowerCase(),
  );

  if (!match || status === "done") return null;

  const senderLabel = fromName ?? fromAddr;

  const handleUnsubscribe = async () => {
    setStatus("loading");
    try {
      const result = await unsubscribe({
        fromAddr: match.fromAddr,
        unsubscribeUrl: match.unsubscribeUrl ?? undefined,
        unsubscribeEmail: match.unsubscribeEmail ?? undefined,
      });

      if (result.success) {
        setStatus("done");
        toast(`Unsubscribed from ${senderLabel}`);
        void router.invalidate();
        void queryClient.invalidateQueries({
          queryKey: queryKeys.subscriptions(),
        });
      } else if (result.method === "manual" && result.url) {
        setStatus("idle");
        window.open(result.url, "_blank", "noopener");
      }
    } catch {
      setStatus("idle");
      toast.error("Failed to unsubscribe");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2">
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        {match.emailCount} email{match.emailCount !== 1 && "s"} from{" "}
        {senderLabel}
      </p>
      <Button
        size="xs"
        variant="ghost"
        disabled={status === "loading"}
        onClick={handleUnsubscribe}
      >
        {status === "loading" ? "..." : "Unsubscribe"}
      </Button>
    </div>
  );
}
