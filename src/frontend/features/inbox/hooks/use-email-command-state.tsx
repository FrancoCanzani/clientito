import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    type ReactNode,
} from "react";

export type EmailCommand =
  | { type: "selection-mode"; enabled: boolean }
  | { type: "select-all-visible" }
  | { type: "clear-selection" }
  | { type: "open-first-visible" }
  | { type: "navigate-next" }
  | { type: "navigate-prev" }
  | { type: "archive" }
  | { type: "trash" }
  | { type: "escape" };

type EmailCommandContextValue = {
  issueCommand: (command: EmailCommand) => void;
  registerHandler: (handler: ((command: EmailCommand) => void) | null) => void;
};

const EmailCommandContext = createContext<EmailCommandContextValue | null>(null);

export function EmailCommandProvider({
  children,
}: {
  children: ReactNode;
}) {
  const handlerRef = useRef<((command: EmailCommand) => void) | null>(null);

  const issueCommand = useCallback((command: EmailCommand) => {
    handlerRef.current?.(command);
  }, []);

  const registerHandler = useCallback(
    (handler: ((command: EmailCommand) => void) | null) => {
      handlerRef.current = handler;
    },
    [],
  );

  const value = useMemo(
    () => ({
      issueCommand,
      registerHandler,
    }),
    [issueCommand, registerHandler],
  );

  return (
    <EmailCommandContext.Provider value={value}>
      {children}
    </EmailCommandContext.Provider>
  );
}

function useEmailCommandContext() {
  const value = useContext(EmailCommandContext);
  if (!value) {
    throw new Error(
      "useEmailCommandContext must be used within EmailCommandProvider",
    );
  }

  return value;
}

export function useEmailCommandActions() {
  return useEmailCommandContext().issueCommand;
}

export function useRegisterEmailCommandHandler(
  handler: (command: EmailCommand) => void,
) {
  const { registerHandler } = useEmailCommandContext();

  useEffect(() => {
    registerHandler(handler);

    return () => registerHandler(null);
  }, [handler, registerHandler]);
}
