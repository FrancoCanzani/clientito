import { useAppAgent } from "@/hooks/use-agent";
import { isToolUIPart } from "ai";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { PaletteMode } from "./types";

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

  const {
    messages,
    sendMessage,
    status,
    addToolApprovalResponse,
    clearHistory,
    isConnected,
  } = useAppAgent();

  const hasPendingApprovals = messages.some((message) =>
    message.parts.some(
      (part) => isToolUIPart(part) && part.state === "approval-requested",
    ),
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setMode("commands");
    setTaskInput("");
    setAgentHasSubmitted(false);
  }, []);

  const submitAgentMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (hasPendingApprovals) {
        toast.error("Approve or discard the pending action before sending another message.");
        return;
      }
      setAgentHasSubmitted(true);
      sendMessage({ text: trimmed });
    },
    [hasPendingApprovals, sendMessage],
  );

  const enterAgentMode = useCallback(
    (initialQuery?: string) => {
      const text = initialQuery?.trim();
      setMode("agent");
      setOpen(true);
      setQuery("");
      setAgentHasSubmitted(false);
      setTimeout(() => agentInputRef.current?.focus(), 0);
      if (text) {
        submitAgentMessage(text);
      }
    },
    [submitAgentMessage],
  );

  const startFreshChat = useCallback(() => {
    setAgentHasSubmitted(false);
    clearHistory();
    setTimeout(() => agentInputRef.current?.focus(), 0);
  }, [clearHistory]);

  const handleAgentSubmit = useCallback(() => {
    const text = agentInput.trim();
    if (!text) return;
    submitAgentMessage(text);
    setAgentInput("");
  }, [agentInput, submitAgentMessage]);

  useHotkey("Mod+K", () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  });

  useHotkey(
    "Escape",
    () => {
      if (mode === "agent") {
        setMode("commands");
        setTimeout(() => inputRef.current?.focus(), 0);
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
    // Callbacks
    close,
    submitAgentMessage,
    enterAgentMode,
    startFreshChat,
    handleAgentSubmit,
  };
}
