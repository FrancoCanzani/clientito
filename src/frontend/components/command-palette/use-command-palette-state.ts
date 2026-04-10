import { useAppAgent } from "@/hooks/use-agent";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "@tanstack/react-router";
import { isToolUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { discardPendingApprovalParts } from "./agent-approval-utils";
import { resolveMode, MODE_PLACEHOLDERS } from "./modes/resolve-mode";
import type { InputMode } from "./modes/types";
import type { PaletteMode } from "./types";

function focusDelayed(ref: React.RefObject<HTMLElement | null>) {
  setTimeout(() => ref.current?.focus(), 0);
}

export function useCommandPaletteState() {
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const agentInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>("commands");
  const [query, setQuery] = useState("");
  const [agentHasSubmitted, setAgentHasSubmitted] = useState(false);
  const [agentInput, setAgentInput] = useState("");

  const {
    messages,
    sendMessage,
    status,
    addToolApprovalResponse,
    clearHistory,
    isConnected,
    setMessages,
  } = useAppAgent();

  const hasPendingApprovals = messages.some((message) =>
    message.parts.some(
      (part) => isToolUIPart(part) && part.state === "approval-requested",
    ),
  );
  const pendingApprovalIds = useMemo(() => {
    const ids: string[] = [];

    for (const message of messages) {
      for (const part of message.parts) {
        if (isToolUIPart(part) && part.state === "approval-requested") {
          ids.push(part.approval.id);
        }
      }
    }

    return ids;
  }, [messages]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setMode("commands");
    setAgentHasSubmitted(false);
  }, []);

  const submitAgentMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (pendingApprovalIds.length > 0) {
        setMessages((currentMessages) =>
          discardPendingApprovalParts(currentMessages),
        );
      }

      setAgentHasSubmitted(true);
      await sendMessage({ text: trimmed });
    },
    [pendingApprovalIds.length, sendMessage, setMessages],
  );

  const enterAgentMode = useCallback(
    (initialQuery?: string) => {
      const text = initialQuery?.trim();
      clearHistory();
      setMode("agent");
      setOpen(true);
      setQuery("");
      setAgentInput("");
      setAgentHasSubmitted(false);
      focusDelayed(agentInputRef);
      if (text) {
        submitAgentMessage(text);
      }
    },
    [clearHistory, submitAgentMessage],
  );

  const startFreshChat = useCallback(() => {
    setAgentHasSubmitted(false);
    clearHistory();
    focusDelayed(agentInputRef);
  }, [clearHistory]);

  const handleAgentSubmit = useCallback(() => {
    const text = agentInput.trim();
    if (!text) return;
    submitAgentMessage(text);
    setAgentInput("");
  }, [agentInput, submitAgentMessage]);

  // Agent suggestions based on current route context
  const router = useRouter();
  const isEmailsRoute = router.state.matches.some(
    (match) =>
      match.routeId.startsWith("/_dashboard/$mailboxId/inbox") ||
      match.routeId === "/_dashboard/$mailboxId/$folder/" ||
      match.routeId === "/_dashboard/$mailboxId/$folder/email/$emailId",
  );

  const agentSuggestions = useMemo(() => {
    if (isEmailsRoute) {
      return [
        "Summarize what I'm looking at",
        "Draft a reply for the current email",
        "What should I follow up on here?",
      ];
    }
    return [
      "What needs my attention in email today?",
      "Find emails I should reply to",
      "Draft a concise response for this sender",
    ];
  }, [isEmailsRoute]);

  // Cmd/Ctrl+K opens the palette and Escape exits/ closes it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isCommandK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (isCommandK) {
        event.preventDefault();
        setOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setMode((currentMode) => {
          if (currentMode === "agent") {
            focusDelayed(inputRef);
            return "commands";
          }
          setOpen(false);
          setQuery("");
          setAgentHasSubmitted(false);
          return "commands";
        });
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    focusDelayed(mode === "agent" ? agentInputRef : inputRef);
  }, [mode, open]);

  // Auto-scroll agent messages
  useEffect(() => {
    if (mode !== "agent") return;
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [mode, messages, status]);

  // Derive input mode from query prefix (only when not in agent mode)
  const { mode: inputMode, query: modeQuery } = useMemo(
    () =>
      mode === "agent"
        ? { mode: "agent" as InputMode, query: "" }
        : resolveMode(query),
    [mode, query],
  );

  const inputPlaceholder =
    mode === "agent"
      ? hasPendingApprovals
        ? "Approve, discard, or revise..."
        : "Ask the agent..."
      : MODE_PLACEHOLDERS[inputMode];

  return {
    // Refs
    inputRef,
    agentInputRef,
    containerRef,
    messagesViewportRef,
    isMobile,
    // State
    open,
    setOpen,
    mode,
    setMode,
    query,
    setQuery,
    agentHasSubmitted,
    agentInput,
    setAgentInput,
    // Input mode
    inputMode,
    modeQuery,
    inputPlaceholder,
    // Agent
    messages,
    status,
    isConnected,
    hasPendingApprovals,
    addToolApprovalResponse,
    agentSuggestions,
    // Callbacks
    close,
    submitAgentMessage,
    enterAgentMode,
    startFreshChat,
    handleAgentSubmit,
  };
}
