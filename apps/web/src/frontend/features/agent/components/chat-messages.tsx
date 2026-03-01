import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { AnimatePresence } from "motion/react";
import { ChatMessageBubble } from "./chat-message-bubble";

export function ChatMessages({
  messages,
  isLoading,
}: {
  messages: UIMessage[];
  isLoading: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
    >
      <AnimatePresence mode="popLayout">
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}
      </AnimatePresence>
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
            <span className="inline-block animate-pulse">...</span>
          </div>
        </div>
      )}
    </div>
  );
}
