import { createContext, useContext } from "react";
import type { ComposeInitial } from "../types";
import { openCompose as emitOpenCompose } from "./compose-events";

export type MailComposeContextValue = {
  openCompose: (initial?: ComposeInitial) => void;
  closeCompose: () => void;
  isOpen: boolean;
  initial: ComposeInitial | undefined;
};

export const MailComposeContext =
  createContext<MailComposeContextValue | null>(null);

export function useMailCompose() {
  const context = useContext(MailComposeContext);
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
