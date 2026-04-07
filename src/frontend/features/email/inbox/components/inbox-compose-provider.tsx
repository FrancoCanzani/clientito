import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getRouteApi } from "@tanstack/react-router";
import type { ComposeInitial } from "../types";
import { ComposePanel } from "./compose-panel";
import { registerOpenComposeListener } from "./compose-events";

type InboxComposeContextValue = {
  openCompose: (initial?: ComposeInitial) => void;
  closeCompose: () => void;
  isOpen: boolean;
  initial: ComposeInitial | undefined;
};

const InboxComposeContext = createContext<InboxComposeContextValue | null>(null);
const inboxRoute = getRouteApi("/_dashboard/$mailboxId/inbox");

export function InboxComposeProvider({ children }: { children: ReactNode }) {
  const { mailboxId } = inboxRoute.useParams();
  const [isOpen, setIsOpen] = useState(false);
  const [initial, setInitial] = useState<ComposeInitial | undefined>();

  const openCompose = useCallback(
    (nextInitial?: ComposeInitial) => {
      setInitial({
        ...nextInitial,
        mailboxId: nextInitial?.mailboxId ?? mailboxId,
      });
      setIsOpen(true);
    },
    [mailboxId],
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
      <ComposePanel
        open={isOpen}
        initial={initial}
        onOpenChange={(open) => {
          if (!open) closeCompose();
        }}
      />
    </InboxComposeContext.Provider>
  );
}

export function useInboxCompose() {
  const context = useContext(InboxComposeContext);
  if (!context) {
    throw new Error("useInboxCompose must be used within InboxComposeProvider");
  }
  return context;
}
