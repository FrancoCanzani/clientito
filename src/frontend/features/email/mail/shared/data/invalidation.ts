import {
  emailQueryKeys,
  isEmailListQueryKey,
} from "@/features/email/mail/shared/query-keys";
import { queryClient } from "@/lib/query-client";
import { dbClient } from "@/db/worker-client";
import { Throttler } from "@tanstack/pacer/throttler";

const EMAIL_QUERY_INVALIDATION_THROTTLE_MS = 100;

type InvalidationScope = {
  lists?: boolean;
  details?: Set<string>;
  threads?: Set<string>;
  unreadCounts?: Set<number>;
};

let pendingScope: InvalidationScope = {};
let flushScheduled = false;

function flushInvalidations() {
  flushScheduled = false;
  const scope = pendingScope;
  pendingScope = {};

  if (scope.lists) {
    invalidateEmailListsNow();
  }

  if (scope.details) {
    for (const emailId of scope.details) {
      void queryClient.invalidateQueries({
        queryKey: emailQueryKeys.detail(emailId),
      });
    }
  }

  if (scope.threads) {
    for (const threadId of scope.threads) {
      void queryClient.invalidateQueries({
        queryKey: emailQueryKeys.thread(threadId),
      });
    }
  }

  if (scope.unreadCounts) {
    for (const mailboxId of scope.unreadCounts) {
      void queryClient.invalidateQueries({
        queryKey: emailQueryKeys.inboxUnreadCount(mailboxId),
      });
      void queryClient.invalidateQueries({
        queryKey: emailQueryKeys.viewCounts(mailboxId),
      });
    }
  }
}

const throttler = new Throttler(flushInvalidations, {
  wait: EMAIL_QUERY_INVALIDATION_THROTTLE_MS,
  leading: false,
  trailing: true,
});

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  throttler.maybeExecute();
}

export function invalidateInboxQueriesThrottled(): void {
  pendingScope.lists = true;
  scheduleFlush();
}

export function invalidateInboxQueries(): void {
  invalidateInboxQueriesThrottled();
}

export function invalidateEmailListsNow(): void {
  void queryClient.invalidateQueries({
    predicate: (query) => isEmailListQueryKey(query.queryKey),
  });
}

export function invalidateEmailDetail(emailId: string): void {
  if (!pendingScope.details) pendingScope.details = new Set();
  pendingScope.details.add(emailId);
  scheduleFlush();
}

export function invalidateEmailThread(threadId: string): void {
  if (!pendingScope.threads) pendingScope.threads = new Set();
  pendingScope.threads.add(threadId);
  scheduleFlush();
}

export function invalidateUnreadCounts(mailboxId: number): void {
  if (!pendingScope.unreadCounts) pendingScope.unreadCounts = new Set();
  pendingScope.unreadCounts.add(mailboxId);
  scheduleFlush();
}

export function invalidateAllEmailQueries(): void {
  void queryClient.invalidateQueries({ queryKey: emailQueryKeys.all() });
}

dbClient.onNotification((notification) => {
  const { tables, providerMessageIds, threadIds, mailboxId } = notification;

  const hasEmails = tables.some((t) =>
    t === "emails" || t === "email_bodies" || t === "email_labels",
  );
  const hasLabels = tables.includes("labels");
  const hasDrafts = tables.includes("drafts");
  const hasSplitViews = tables.includes("split_views");

  if (hasEmails) {
    if (providerMessageIds && providerMessageIds.length > 0) {
      for (const pmId of providerMessageIds) {
        invalidateEmailDetail(pmId);
      }
    }
    if (threadIds && threadIds.length > 0) {
      for (const tId of threadIds) {
        invalidateEmailThread(tId);
      }
    }
    invalidateInboxQueriesThrottled();
    if (mailboxId != null) invalidateUnreadCounts(mailboxId);
  }

  if (hasLabels && mailboxId != null) {
    invalidateUnreadCounts(mailboxId);
  }

  if (hasDrafts) {
    void queryClient.invalidateQueries({ queryKey: ["drafts"] });
  }

  if (hasSplitViews) {
    void queryClient.invalidateQueries({ queryKey: ["splitViews"] });
  }
});
