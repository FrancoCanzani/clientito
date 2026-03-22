import { useEmailData } from "@/features/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/inbox/hooks/use-email-inbox-actions";
import { useSelectionStore } from "@/features/inbox/stores/selection-store";
import type { ComposeInitial, EmailListItem } from "@/features/inbox/types";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
import type { ThreadSection } from "@/features/inbox/utils/build-thread-sections";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type RefCallback,
} from "react";

type Selection = ReturnType<typeof useSelectionStore>;
type Actions = ReturnType<typeof useEmailInboxActions>;

type EmailContextValue = {
  view: EmailView;
  selectedEmailId: string | null;
  mailboxId: number | null;
  displayRows: EmailListItem[];
  sections: ThreadSection[];
  selectedEmail: EmailListItem | null;
  orderedIds: string[];
  emailById: Map<string, EmailListItem>;
  isPending: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMoreRef: RefCallback<HTMLDivElement>;
  selection: Selection;
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
  const selection = useSelectionStore(emailData.displayRows);

  const selectedIds = useMemo(
    () => Array.from(selection.selectedIds),
    [selection.selectedIds],
  );

  const { openEmail, closeEmail, executeEmailAction } = useEmailInboxActions({
    view: emailData.view,
    mailboxId: emailData.mailboxId,
    selectedEmailId: emailData.selectedEmailId,
    selectedIds,
    clearSelection: selection.clearSelection,
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

  const value = useMemo<EmailContextValue>(
    () => ({
      ...emailData,
      selection,
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
      selection,
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
