import { createContext, useContext } from "react";
import type { ComposeInitial } from "../types";
import { openCompose as emitOpenCompose } from "./compose-events";

export type ComposerMode = "modal" | "dock";
export type ComposerState = "expanded" | "minimized";

export type ComposerWindow = {
  id: string;
  initial: ComposeInitial;
  mode: ComposerMode;
  state: ComposerState;
};

export type MailComposeContextValue = {
  composers: ComposerWindow[];
  openCompose: (initial?: ComposeInitial) => void;
  closeCompose: (id: string) => void;
  setComposerMode: (id: string, mode: ComposerMode) => void;
  setComposerState: (id: string, state: ComposerState) => void;
};

export const MailComposeContext =
  createContext<MailComposeContextValue | null>(null);

export function useMailCompose(): MailComposeContextValue {
  const context = useContext(MailComposeContext);
  if (!context) {
    return {
      composers: [],
      openCompose: (initial?: ComposeInitial) => emitOpenCompose(initial),
      closeCompose: () => {},
      setComposerMode: () => {},
      setComposerState: () => {},
    };
  }
  return context;
}
