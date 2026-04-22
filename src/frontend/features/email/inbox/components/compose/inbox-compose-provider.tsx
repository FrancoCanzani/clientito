import type { ReactNode } from "react";
import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "@tanstack/react-router";
import type { ComposeInitial } from "../../types";
import { openCompose as emitOpenCompose, registerOpenComposeListener } from "./compose-events";

const ComposePanel = lazy(async () => {
  const mod = await import("./compose-panel");
  return { default: mod.ComposePanel };
});

type InboxComposeContextValue = {
  openCompose: (initial?: ComposeInitial) => void;
  closeCompose: () => void;
  isOpen: boolean;
  initial: ComposeInitial | undefined;
};

const InboxComposeContext = createContext<InboxComposeContextValue | null>(null);

export function InboxComposeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [initial, setInitial] = useState<ComposeInitial | undefined>();
  const mailboxIdParam = router.state.matches.find(
    (match) => match.routeId === "/_dashboard/$mailboxId",
  )?.params.mailboxId;
  const activeMailboxId =
    mailboxIdParam != null ? Number(mailboxIdParam) : undefined;

  const openCompose = useCallback(
    (nextInitial?: ComposeInitial) => {
      setInitial({
        ...nextInitial,
        mailboxId: nextInitial?.mailboxId ?? activeMailboxId,
      });
      setIsOpen(true);
    },
    [activeMailboxId],
  );

  const closeCompose = useCallback(() => {
    setIsOpen(false);
    setInitial(undefined);
  }, []);

  useEffect(
    () =>
      registerOpenComposeListener((nextInitial) => {
        openCompose(nextInitial);
      }),
    [openCompose],
  );

  const value = useMemo(
    () => ({ openCompose, closeCompose, isOpen, initial }),
    [openCompose, closeCompose, isOpen, initial],
  );

  return (
    <InboxComposeContext.Provider value={value}>
      {children}
      {isOpen ? (
        <Suspense fallback={null}>
          <ComposePanel
            open={isOpen}
            initial={initial}
            onOpenChange={(open) => {
              if (!open) closeCompose();
            }}
          />
        </Suspense>
      ) : null}
    </InboxComposeContext.Provider>
  );
}

export function useInboxCompose() {
  const context = useContext(InboxComposeContext);
  if (!context) {
    return {
      openCompose: (initial?: ComposeInitial) => emitOpenCompose(initial),
      closeCompose: () => {},
      isOpen: false,
      initial: undefined,
    };
  }
  return context;
}
