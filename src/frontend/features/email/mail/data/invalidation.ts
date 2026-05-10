import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { queryClient } from "@/lib/query-client";
import { Throttler } from "@tanstack/pacer/throttler";

const EMAIL_QUERY_INVALIDATION_THROTTLE_MS = 100;
let needsEmailQueryInvalidation = false;
const emailQueryInvalidationThrottler = new Throttler(
  () => {
    if (!needsEmailQueryInvalidation) return;
    needsEmailQueryInvalidation = false;
    void queryClient.invalidateQueries({ queryKey: emailQueryKeys.all() });
  },
  {
    wait: EMAIL_QUERY_INVALIDATION_THROTTLE_MS,
    leading: false,
    trailing: true,
  },
);

export function invalidateInboxQueriesThrottled(): void {
  needsEmailQueryInvalidation = true;
  emailQueryInvalidationThrottler.maybeExecute();
}

export function invalidateInboxQueries() {
  invalidateInboxQueriesThrottled();
}
