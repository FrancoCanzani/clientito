import { useEmailData } from "@/features/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/inbox/hooks/use-email-inbox-actions";
import type { ComposeInitial, EmailListItem } from "@/features/inbox/types";
import type { ThreadSection } from "@/features/inbox/utils/build-thread-sections";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefCallback,
} from "react";
import { registerOpenComposeListener } from "../components/compose-bridge";

type Actions = ReturnType<typeof useEmailInboxActions>;

type EmailContextValue = {
  view: EmailView;
  mailboxId: number | null;
  displayRows: EmailListItem[];
  sections: ThreadSection[];
  orderedIds: string[];
  emailById: Map<string, EmailListItem>;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMoreRef: RefCallback<HTMLDivElement>;
  openEmail: Actions["openEmail"];
  closeEmail: Actions["closeEmail"];
  executeEmailAction: Actions["executeEmailAction"];
  forward: (initial: ComposeInitial) => void;
  composeInitial: ComposeInitial | undefined;
  forwardOpen: boolean;
  closeForward: () => void;
};

const EmailContext = createContext<EmailContextValue | null>(null);

export function EmailProvider({ children }: { children: ReactNode }) {
  const emailData = useEmailData();

  const { openEmail, closeEmail, executeEmailAction } = useEmailInboxActions({
    view: emailData.view,
    mailboxId: emailData.mailboxId,
  });

  const [composeInitial, setComposeInitial] = useState<
    ComposeInitial | undefined
  >();
  const [forwardOpen, setForwardOpen] = useState(false);

  const forward = useCallback((initial: ComposeInitial) => {
    setComposeInitial(initial);
    setForwardOpen(true);
  }, []);

  const closeForward = useCallback(() => {
    setForwardOpen(false);
    setComposeInitial(undefined);
  }, []);

  useEffect(() => {
    return registerOpenComposeListener((initial) => {
      setComposeInitial(initial);
      setForwardOpen(true);
    });
  }, []);

  const value = useMemo<EmailContextValue>(
    () => ({
      ...emailData,
      openEmail,
      closeEmail,
      executeEmailAction,
      forward,
      composeInitial,
      forwardOpen,
      closeForward,
    }),
    [
      emailData,
      openEmail,
      closeEmail,
      executeEmailAction,
      forward,
      composeInitial,
      forwardOpen,
      closeForward,
    ],
  );

  return (
    <EmailContext.Provider value={value}>{children}</EmailContext.Provider>
  );
}

export function useEmail() {
  const ctx = useContext(EmailContext);
  if (!ctx) throw new Error("useEmail must be used within EmailProvider");
  return ctx;
}
