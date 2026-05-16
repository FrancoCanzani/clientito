import { localDb } from "@/db/client";
import type { EmailListItem } from "@/features/email/mail/shared/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type ReaderTab = {
  id: string;
  subject: string;
};

type Setter = (id: string | null) => void;

const PERSIST_DELAY_MS = 200;

function metaKey(mailboxId: number) {
  return `reader-tabs:${mailboxId}`;
}

function parseStored(raw: string | null): ReaderTab[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ReaderTab =>
        entry && typeof entry.id === "string" && typeof entry.subject === "string",
    );
  } catch {
    return [];
  }
}

function tabFromEmail(email: EmailListItem): ReaderTab {
  return {
    id: email.id,
    subject: email.subject?.trim() || "(no subject)",
  };
}

export function useReaderTabs({
  mailboxId,
  activeId,
  setActiveId,
  enabled,
}: {
  mailboxId: number;
  activeId: string | null;
  setActiveId: Setter;
  enabled: boolean;
}) {
  const [pinned, setPinned] = useState<ReaderTab[]>([]);
  const [ephemeral, setEphemeral] = useState<ReaderTab | null>(null);
  const hydratedRef = useRef(false);
  const lastMailboxRef = useRef(mailboxId);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useEffect(() => {
    if (!enabled) return;
    hydratedRef.current = false;
    lastMailboxRef.current = mailboxId;
    let cancelled = false;
    void localDb.getMeta(metaKey(mailboxId)).then((raw) => {
      if (cancelled || lastMailboxRef.current !== mailboxId) return;
      const stored = parseStored(raw);
      setPinned(stored);
      const pinnedHasActive = activeIdRef.current
        ? stored.some((t) => t.id === activeIdRef.current)
        : false;
      setEphemeral(
        activeIdRef.current && !pinnedHasActive
          ? { id: activeIdRef.current, subject: "" }
          : null,
      );
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [mailboxId, enabled]);

  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;
    const handle = setTimeout(() => {
      void localDb.setMeta(metaKey(mailboxId), JSON.stringify(pinned));
    }, PERSIST_DELAY_MS);
    return () => clearTimeout(handle);
  }, [pinned, mailboxId, enabled]);

  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;
    if (!activeId) {
      setEphemeral(null);
      return;
    }
    const inPinned = pinned.some((t) => t.id === activeId);
    if (inPinned) {
      setEphemeral(null);
      return;
    }
    setEphemeral((curr) =>
      curr && curr.id === activeId ? curr : { id: activeId, subject: "" },
    );
  }, [activeId, pinned, enabled]);

  const openInActive = useCallback(
    (email: EmailListItem) => {
      const next = tabFromEmail(email);
      if (pinned.some((t) => t.id === next.id)) {
        setActiveId(next.id);
        return;
      }
      setEphemeral(next);
      setActiveId(next.id);
    },
    [pinned, setActiveId],
  );

  const openInNew = useCallback(
    (email: EmailListItem) => {
      const next = tabFromEmail(email);
      setPinned((curr) => {
        if (curr.some((t) => t.id === next.id)) return curr;
        const idx = curr.findIndex((t) => t.id === activeIdRef.current);
        const insertAt = idx < 0 ? curr.length : idx + 1;
        const copy = [...curr];
        copy.splice(insertAt, 0, next);
        return copy;
      });
      setEphemeral((curr) => (curr && curr.id === next.id ? null : curr));
      setActiveId(next.id);
    },
    [setActiveId],
  );

  const close = useCallback(
    (id: string) => {
      if (ephemeral?.id === id) {
        setEphemeral(null);
        if (activeIdRef.current === id) {
          const fallback = pinned[pinned.length - 1] ?? null;
          setActiveId(fallback?.id ?? null);
        }
        return;
      }
      setPinned((curr) => {
        const idx = curr.findIndex((t) => t.id === id);
        if (idx < 0) return curr;
        const next = curr.filter((t) => t.id !== id);
        if (activeIdRef.current === id) {
          const fallback =
            next[idx] ?? next[idx - 1] ?? ephemeral ?? null;
          setActiveId(fallback?.id ?? null);
        }
        return next;
      });
    },
    [ephemeral, pinned, setActiveId],
  );

  const closeActive = useCallback(() => {
    if (activeId) close(activeId);
  }, [activeId, close]);

  const pin = useCallback(
    (id: string) => {
      if (pinned.some((t) => t.id === id)) return;
      const source = ephemeral?.id === id ? ephemeral : null;
      if (!source) return;
      setPinned((curr) => [...curr, source]);
      setEphemeral(null);
    },
    [pinned, ephemeral],
  );

  const closeOthers = useCallback(
    (keepId: string) => {
      setPinned((curr) => curr.filter((t) => t.id === keepId));
      setEphemeral((curr) => (curr && curr.id === keepId ? curr : null));
      if (activeIdRef.current !== keepId) setActiveId(keepId);
    },
    [setActiveId],
  );

  const closeAll = useCallback(() => {
    setPinned([]);
    setEphemeral(null);
    setActiveId(null);
  }, [setActiveId]);

  const switchTo = useCallback(
    (id: string) => {
      setActiveId(id);
    },
    [setActiveId],
  );

  const switchByOffset = useCallback(
    (delta: number) => {
      const strip: ReaderTab[] = ephemeral ? [...pinned, ephemeral] : pinned;
      if (strip.length === 0) return;
      const idx = strip.findIndex((t) => t.id === activeId);
      const base = idx < 0 ? 0 : idx;
      const nextIdx = (base + delta + strip.length) % strip.length;
      const target = strip[nextIdx];
      if (target) setActiveId(target.id);
    },
    [pinned, ephemeral, activeId, setActiveId],
  );

  const updateSubject = useCallback((id: string, subject: string) => {
    const trimmed = subject.trim();
    if (!trimmed) return;
    setPinned((curr) =>
      curr.some((t) => t.id === id && t.subject !== trimmed)
        ? curr.map((t) => (t.id === id ? { ...t, subject: trimmed } : t))
        : curr,
    );
    setEphemeral((curr) =>
      curr && curr.id === id && curr.subject !== trimmed
        ? { ...curr, subject: trimmed }
        : curr,
    );
  }, []);

  return {
    pinned,
    ephemeral,
    openInActive,
    openInNew,
    close,
    closeActive,
    closeOthers,
    closeAll,
    pin,
    switchTo,
    switchByOffset,
    updateSubject,
  };
}
