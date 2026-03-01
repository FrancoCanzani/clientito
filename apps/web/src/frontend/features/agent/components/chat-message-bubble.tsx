import type { UIMessage } from "ai";
import { motion } from "motion/react";
import { stripNavigationBlocks } from "../lib/parse-navigation";

export function ChatMessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  const text =
    message.parts
      ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "";

  const displayText = isUser ? text : stripNavigationBlocks(text);
  if (!displayText) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-foreground text-background"
            : "bg-muted text-foreground"
        }`}
      >
        {displayText}
      </div>
    </motion.div>
  );
}
