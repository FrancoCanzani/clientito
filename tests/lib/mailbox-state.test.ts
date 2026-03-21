import { describe, it, expect, beforeEach } from "vitest";
import {
  acquireMailboxSyncLock,
  releaseMailboxSyncLock,
  touchMailboxSyncLock,
  createSyncJob,
  markSyncJobSucceeded,
  markSyncJobFailed,
  expireStaleSyncJobs,
  getMailboxSyncSnapshot,
  ensureMailbox,
  getUserMailboxes,
  persistMailboxHistoryState,
  resetMailboxSyncState,
  SYNC_LOCK_TTL_MS,
} from "../../src/worker/lib/gmail/mailbox-state";
import { setupTestDb, TEST_USER, getDb } from "../helpers/setup";
import { seedMailbox, seedAccount } from "../helpers/seed";
import type { Database } from "../../src/worker/db/client";

let db: Database;
let mailboxId: number;

describe("Mailbox State", () => {
  beforeEach(async () => {
    db = await setupTestDb();
    mailboxId = await seedMailbox();
  });

  // --- Lock management ---
  describe("Sync lock", () => {
    it("acquires a lock on an unlocked mailbox", async () => {
      const acquired = await acquireMailboxSyncLock(db, mailboxId);
      expect(acquired).toBe(true);
    });

    it("fails to acquire when already locked", async () => {
      await acquireMailboxSyncLock(db, mailboxId);
      const second = await acquireMailboxSyncLock(db, mailboxId);
      expect(second).toBe(false);
    });

    it("releases a lock", async () => {
      await acquireMailboxSyncLock(db, mailboxId);
      await releaseMailboxSyncLock(db, mailboxId);
      const reacquired = await acquireMailboxSyncLock(db, mailboxId);
      expect(reacquired).toBe(true);
    });

    it("touch extends the lock", async () => {
      await acquireMailboxSyncLock(db, mailboxId);
      const touched = await touchMailboxSyncLock(db, mailboxId);
      expect(touched).toBe(true);
    });

    it("touch fails on unlocked mailbox", async () => {
      const touched = await touchMailboxSyncLock(db, mailboxId);
      expect(touched).toBe(false);
    });
  });

  // --- Sync jobs ---
  describe("Sync jobs", () => {
    it("creates a running job", async () => {
      const job = await createSyncJob(db, mailboxId, "full", "manual");
      expect(job.status).toBe("running");
      expect(job.kind).toBe("full");
      expect(job.trigger).toBe("manual");
      expect(job.mailboxId).toBe(mailboxId);
    });

    it("marks job succeeded and updates mailbox", async () => {
      const job = await createSyncJob(db, mailboxId, "full", "manual");
      await markSyncJobSucceeded(db, mailboxId, job.id);

      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.latestJob?.status).toBe("succeeded");
      expect(snapshot.mailbox?.authState).toBe("ok");
      expect(snapshot.mailbox?.lastSuccessfulSyncAt).toBeTypeOf("number");
      expect(snapshot.mailbox?.lockUntil).toBeNull();
    });

    it("marks job failed and updates mailbox", async () => {
      const job = await createSyncJob(db, mailboxId, "full", "manual");
      await markSyncJobFailed(db, mailboxId, job.id, "Token expired", "transient");

      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.latestJob?.status).toBe("failed");
      expect(snapshot.latestJob?.errorMessage).toBe("Token expired");
      expect(snapshot.mailbox?.lastErrorMessage).toBe("Token expired");
      expect(snapshot.mailbox?.lockUntil).toBeNull();
    });

    it("marks reconnect_required on auth error", async () => {
      const job = await createSyncJob(db, mailboxId, "full", "manual");
      await markSyncJobFailed(
        db,
        mailboxId,
        job.id,
        "invalid_grant",
        "reconnect_required",
      );

      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.mailbox?.authState).toBe("reconnect_required");
    });
  });

  // --- Stale job expiry ---
  describe("Stale job expiry", () => {
    it("expires stale running jobs", async () => {
      const job = await createSyncJob(db, mailboxId, "full", "manual");

      const expired = await expireStaleSyncJobs(db, mailboxId);
      expect(expired).toBe(true);

      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.latestJob?.status).toBe("failed");
      expect(snapshot.latestJob?.errorClass).toBe("stale_lock");
    });

    it("does nothing when no running jobs", async () => {
      const expired = await expireStaleSyncJobs(db, mailboxId);
      expect(expired).toBe(false);
    });
  });

  // --- Snapshot ---
  describe("getMailboxSyncSnapshot", () => {
    it("returns null for nonexistent mailbox", async () => {
      const snapshot = await getMailboxSyncSnapshot(db, 99999);
      expect(snapshot.mailbox).toBeNull();
    });

    it("reports hasLiveLock when locked", async () => {
      await acquireMailboxSyncLock(db, mailboxId);
      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.hasLiveLock).toBe(true);
    });

    it("reports no lock when unlocked", async () => {
      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.hasLiveLock).toBe(false);
    });

    it("finds active job when locked", async () => {
      await acquireMailboxSyncLock(db, mailboxId);
      await createSyncJob(db, mailboxId, "full", "manual");

      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.activeJob).not.toBeNull();
      expect(snapshot.activeJob?.status).toBe("running");
    });
  });

  // --- ensureMailbox ---
  describe("ensureMailbox", () => {
    it("creates a mailbox for new accountId", async () => {
      const acctId = await seedAccount({ id: "new-account-id" });
      const mb = await ensureMailbox(db, TEST_USER.id, acctId, "new@gmail.com");
      expect(mb).not.toBeNull();
      expect(mb?.gmailEmail).toBe("new@gmail.com");
    });

    it("returns existing mailbox for same accountId", async () => {
      const acctId = await seedAccount({ id: "acct-1" });
      const mb1 = await ensureMailbox(db, TEST_USER.id, acctId, "a@gmail.com");
      const mb2 = await ensureMailbox(db, TEST_USER.id, acctId, "a@gmail.com");
      expect(mb1?.id).toBe(mb2?.id);
    });

    it("updates gmailEmail on existing mailbox", async () => {
      const acctId = await seedAccount({ id: "acct-2" });
      await ensureMailbox(db, TEST_USER.id, acctId, "old@gmail.com");
      const mb = await ensureMailbox(db, TEST_USER.id, acctId, "new@gmail.com");
      expect(mb?.gmailEmail).toBe("new@gmail.com");
    });

    it("getUserMailboxes returns all user mailboxes", async () => {
      const acctA = await seedAccount({ id: "acct-a" });
      const acctB = await seedAccount({ id: "acct-b" });
      await ensureMailbox(db, TEST_USER.id, acctA, "a@gmail.com");
      await ensureMailbox(db, TEST_USER.id, acctB, "b@gmail.com");

      const all = await getUserMailboxes(db, TEST_USER.id);
      // +1 for the one created in beforeEach via seedMailbox
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  // --- History state ---
  describe("persistMailboxHistoryState", () => {
    it("sets historyId", async () => {
      await persistMailboxHistoryState(db, mailboxId, "12345");
      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.mailbox?.historyId).toBe("12345");
    });

    it("only updates to higher historyId", async () => {
      await persistMailboxHistoryState(db, mailboxId, "200");
      await persistMailboxHistoryState(db, mailboxId, "100");
      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.mailbox?.historyId).toBe("200");
    });

    it("does nothing for null historyId", async () => {
      await persistMailboxHistoryState(db, mailboxId, "100");
      await persistMailboxHistoryState(db, mailboxId, null);
      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.mailbox?.historyId).toBe("100");
    });
  });

  // --- Reset ---
  describe("resetMailboxSyncState", () => {
    it("clears historyId, errors, and lock", async () => {
      await acquireMailboxSyncLock(db, mailboxId);
      await persistMailboxHistoryState(db, mailboxId, "999");
      await resetMailboxSyncState(db, mailboxId);

      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.mailbox?.historyId).toBeNull();
      expect(snapshot.mailbox?.lockUntil).toBeNull();
      expect(snapshot.hasLiveLock).toBe(false);
    });

    it("fails running jobs", async () => {
      const job = await createSyncJob(db, mailboxId, "full", "manual");
      await resetMailboxSyncState(db, mailboxId);

      const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
      expect(snapshot.latestJob?.status).toBe("failed");
      expect(snapshot.latestJob?.errorMessage).toBe("Reset by user");
    });
  });
});
