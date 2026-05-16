import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { ComposeInitial } from "@/features/email/mail/shared/types";
import {
  MailComposeContext,
  type ComposerMode,
  type ComposerState,
  type ComposerWindow,
} from "@/features/email/mail/compose/compose-context";
import { ComposeDock } from "@/features/email/mail/compose/compose-dock";
import { getComposePanelKey } from "@/features/email/mail/compose/compose-email-state";
import { registerOpenComposeListener } from "@/features/email/mail/compose/compose-events";

const MAX_EXPANDED_DOCK = 3;

export function MailComposeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [composers, setComposers] = useState<ComposerWindow[]>([]);
  const mailboxIdParam = router.state.matches.find(
    (match) => match.routeId === "/_dashboard/$mailboxId",
  )?.params.mailboxId;
  const activeMailboxId =
    mailboxIdParam != null ? Number(mailboxIdParam) : undefined;

  const openCompose = useCallback(
    (nextInitial?: ComposeInitial) => {
      const seededInitial: ComposeInitial = {
        ...nextInitial,
        mailboxId: nextInitial?.mailboxId ?? activeMailboxId,
      };
      const hasStableIdentity =
        Boolean(nextInitial?.composeKey) || Boolean(nextInitial?.threadId);
      const id = hasStableIdentity
        ? getComposePanelKey(seededInitial)
        : `new:${crypto.randomUUID()}`;
      const initialWithKey: ComposeInitial = {
        ...seededInitial,
        composeKey: id,
      };

      setComposers((prev) => {
        const existing = prev.find((c) => c.id === id);
        if (existing) {
          const rest = prev.filter((c) => c.id !== id);
          return [
            ...rest,
            { ...existing, state: "expanded" },
          ];
        }

        const next: ComposerWindow = {
          id,
          initial: initialWithKey,
          mode: "dock",
          state: "expanded",
        };

        const merged = [...prev, next];
        const expandedDock = merged.filter(
          (c) => c.mode === "dock" && c.state === "expanded",
        );
        if (expandedDock.length > MAX_EXPANDED_DOCK) {
          const toMinimize = expandedDock
            .slice(0, expandedDock.length - MAX_EXPANDED_DOCK)
            .map((c) => c.id);
          return merged.map((c) =>
            toMinimize.includes(c.id) && c.id !== next.id
              ? { ...c, state: "minimized" as ComposerState }
              : c,
          );
        }
        return merged;
      });
    },
    [activeMailboxId],
  );

  const closeCompose = useCallback((id: string) => {
    setComposers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const setComposerMode = useCallback((id: string, mode: ComposerMode) => {
    setComposers((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, mode, state: "expanded" as ComposerState } : c,
      ),
    );
  }, []);

  const setComposerState = useCallback(
    (id: string, state: ComposerState) => {
      setComposers((prev) =>
        prev.map((c) => (c.id === id ? { ...c, state } : c)),
      );
    },
    [],
  );

  useEffect(
    () =>
      registerOpenComposeListener((nextInitial) => {
        openCompose(nextInitial);
      }),
    [openCompose],
  );

  const value = useMemo(
    () => ({
      composers,
      openCompose,
      closeCompose,
      setComposerMode,
      setComposerState,
    }),
    [composers, openCompose, closeCompose, setComposerMode, setComposerState],
  );

  return (
    <MailComposeContext.Provider value={value}>
      {children}
      <ComposeDock
        composers={composers}
        closeCompose={closeCompose}
        setComposerMode={setComposerMode}
        setComposerState={setComposerState}
      />
    </MailComposeContext.Provider>
  );
}
