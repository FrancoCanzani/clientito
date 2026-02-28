import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchActionableEmails } from "../api";

const POLL_INTERVAL = 30_000;

export function useActionableEmails(orgId: string, enabled: boolean) {
  const navigate = useNavigate();
  const [lastChecked] = useState(() => Date.now());
  const seenIdsRef = useRef(new Set<string>());

  const query = useQuery({
    queryKey: ["actionable-emails", orgId],
    queryFn: () => fetchActionableEmails(orgId, lastChecked),
    enabled,
    refetchInterval: POLL_INTERVAL,
  });

  useEffect(() => {
    if (!query.data || query.data.length === 0) return;

    const newEmails = query.data.filter((e) => !seenIdsRef.current.has(e.id));

    for (const email of newEmails) {
      seenIdsRef.current.add(email.id);
      const sender = email.customerName ?? email.fromName ?? email.fromAddr;
      toast.info(`New email from ${sender}`, {
        description: email.subject ?? "(no subject)",
        action: {
          label: "View",
          onClick: () =>
            navigate({
              to: "/$orgId/emails",
              params: { orgId },
            }),
        },
      });
    }
  }, [query.data, navigate, orgId]);
}
