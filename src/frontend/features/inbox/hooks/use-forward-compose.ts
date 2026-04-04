import { useCallback, useState } from "react";
import type { ComposeInitial } from "../types";

export function useForwardCompose() {
  const [forwardOpen, setForwardOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<
    ComposeInitial | undefined
  >();

  const openForward = useCallback((initial?: ComposeInitial) => {
    setComposeInitial(initial);
    setForwardOpen(true);
  }, []);

  const closeForward = useCallback(() => {
    setForwardOpen(false);
    setComposeInitial(undefined);
  }, []);

  return { forwardOpen, composeInitial, openForward, closeForward };
}
