import { useEffect } from "react";

export type EmailCommand =
  | { type: "open-first-visible" }
  | { type: "navigate-next" }
  | { type: "navigate-prev" }
  | { type: "archive" }
  | { type: "trash" }
  | { type: "escape" }
  | { type: "reply" }
  | { type: "forward" }
  | { type: "toggle-read" }
  | { type: "toggle-star" };

type EmailCommandHandler = (command: EmailCommand) => void;

let handler: EmailCommandHandler | null = null;

export function issueEmailCommand(command: EmailCommand) {
  handler?.(command);
}

export function useRegisterEmailCommandHandler(fn: EmailCommandHandler) {
  useEffect(() => {
    handler = fn;
    return () => {
      handler = null;
    };
  }, [fn]);
}
