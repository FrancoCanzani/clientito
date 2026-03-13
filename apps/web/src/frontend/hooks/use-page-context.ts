import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

export type EntityContext =
  | {
      type: "email";
      id: string;
      subject: string | null;
      fromName: string | null;
      fromAddr: string;
      threadId: string | null;
    }
  | {
      type: "person";
      id: string;
      name: string | null;
      email: string | null;
      companyName: string | null;
    }
  | {
      type: "company";
      id: string;
      name: string | null;
      domain: string | null;
    }
  | {
      type: "note";
      id: string;
      title: string | null;
    }
  | {
      type: "task";
      id: string;
      title: string;
    };

export type PageContext = {
  route: string;
  entity?: EntityContext;
};

type PageContextStore = {
  get: () => PageContext;
  set: (ctx: PageContext) => void;
  subscribe: (cb: () => void) => () => void;
};

function createPageContextStore(): PageContextStore {
  let current: PageContext = { route: "/" };
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (ctx) => {
      current = ctx;
      for (const cb of listeners) cb();
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

const StoreContext = createContext<PageContextStore | null>(null);

export const PageContextProvider = StoreContext.Provider;
export const createPageContext = createPageContextStore;

function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("PageContextProvider missing");
  return store;
}

export function usePageContext(): PageContext {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useSetPageContext() {
  const store = useStore();
  return store.set;
}

export function useRouteContext(route: string, entity?: EntityContext) {
  const set = useSetPageContext();
  const entityKey = entity ? `${entity.type}:${entity.id}` : "none";
  const entityRef = { current: entity };
  entityRef.current = entity;

  useEffect(() => {
    set({ route, entity: entityRef.current });
  }, [route, entityKey, set]);
}
