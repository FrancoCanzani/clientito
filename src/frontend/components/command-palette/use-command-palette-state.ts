import { useAppAgent } from "@/hooks/use-agent";
import { useHotkey } from "@tanstack/react-hotkeys";
import { isToolUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { discardPendingApprovalParts } from "./agent-approval-utils";
import type { PaletteMode } from "./types";

function focusDelayed(ref: React.RefObject<HTMLElement | null>) {
  setTimeout(() => ref.current?.focus(), 0);
}

export function useCommandPaletteState() {
  const inputRef = useRef<HTMLInputElement>(null);
  const agentInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>("commands");
  const [query, setQuery] = useState("");
  const [agentHasSubmitted, setAgentHasSubmitted] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [agentInput, setAgentInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    setTaskInput("");
    setSearchInput("");
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

  const enterSearchMode = useCallback(() => {
    setMode("search");
    setOpen(true);
    setQuery("");
    setSearchInput("");
    focusDelayed(searchInputRef);
  }, []);

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

  useHotkey("Mod+K", () => {
    setOpen(true);
    focusDelayed(inputRef);
  });

  useHotkey(
    "Escape",
    () => {
      if (mode === "agent" || mode === "search") {
        setMode("commands");
        setSearchInput("");
        focusDelayed(inputRef);
        return;
      }
      close();
    },
    {
      enabled: open || mode === "agent",
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [close, open]);

  useEffect(() => {
    if (mode !== "agent") return;
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [mode, messages, status]);

  return {
    // Refs
    inputRef,
    agentInputRef,
    containerRef,
    messagesViewportRef,
    // State
    open,
    setOpen,
    mode,
    setMode,
    query,
    setQuery,
    agentHasSubmitted,
    taskInput,
    setTaskInput,
    agentInput,
    setAgentInput,
    // Agent
    messages,
    status,
    isConnected,
    hasPendingApprovals,
    addToolApprovalResponse,
    // Search
    searchInput,
    setSearchInput,
    searchInputRef,
    enterSearchMode,
    // Callbacks
    close,
    submitAgentMessage,
    enterAgentMode,
    startFreshChat,
    handleAgentSubmit,
  };
}
