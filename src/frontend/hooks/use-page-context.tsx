import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type PageEntity =
    | {
        type: "email";
        id: string;
        subject: string | null;
        fromName: string | null;
        fromAddr: string;
        threadId: string | null;
        mailboxId: number | null;
        bodyPreview?: string | null;
      }
  | { type: "person"; id: string; name: string | null; email: string | null }
  | { type: "note"; id: string; title: string | null }
  | { type: "task"; id: string; title: string };

export type PageContext = {
  route: string;
  entity?: PageEntity;
  composer?: { body: string } | null;
};

type PageContextState = {
  context: PageContext | null;
  setContext: (ctx: PageContext | null) => void;
};

const PageContextCtx = createContext<PageContextState>({
  context: null,
  setContext: () => {},
});

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<PageContext | null>(null);

  return (
    <PageContextCtx.Provider value={{ context, setContext }}>
      {children}
    </PageContextCtx.Provider>
  );
}

export function usePageContext(): PageContext | null {
  return useContext(PageContextCtx).context;
}

export function useSetPageContext(context: PageContext) {
  const { setContext } = useContext(PageContextCtx);

  useEffect(() => {
    setContext(context);
    return () => setContext(null);
  }, [context, setContext]);
}
