import { cn } from "@/lib/utils";
import { memo, useMemo } from "react";

const AVATAR_COLORS = [
  { bg: "bg-red-100 dark:bg-red-950/50", text: "text-red-700 dark:text-red-300" },
  { bg: "bg-blue-100 dark:bg-blue-950/50", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-green-100 dark:bg-green-950/50", text: "text-green-700 dark:text-green-300" },
  { bg: "bg-amber-100 dark:bg-amber-950/50", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-purple-100 dark:bg-purple-950/50", text: "text-purple-700 dark:text-purple-300" },
  { bg: "bg-pink-100 dark:bg-pink-950/50", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-cyan-100 dark:bg-cyan-950/50", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-orange-100 dark:bg-orange-950/50", text: "text-orange-700 dark:text-orange-300" },
] as const;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitial(name: string | null | undefined, email: string): string {
  const label = name?.trim() || email;
  const stripped = label.replace(
    /[\u{1F600}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FFFF}]/gu,
    "",
  );
  return (stripped.charAt(0) || "?").toUpperCase();
}

type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "size-4 text-[9px] rounded",
  sm: "size-5 text-[10px] rounded",
  md: "size-6 text-xs rounded-md",
  lg: "size-8 text-sm rounded-lg",
};

export const ContactAvatar = memo(function ContactAvatar({
  name,
  email,
  size = "lg",
  className,
}: {
  name?: string | null;
  email: string;
  size?: AvatarSize;
  className?: string;
}) {
  const color = useMemo(
    () => AVATAR_COLORS[hashString(email.toLowerCase()) % AVATAR_COLORS.length]!,
    [email],
  );
  const initial = useMemo(() => getInitial(name, email), [name, email]);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium leading-none select-none",
        SIZE_CLASSES[size],
        color.bg,
        color.text,
        className,
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
});

/**
 * Stacked avatars for multi-sender threads.
 * Progressively shrinks as more senders are shown (max 4).
 */
export function AvatarStack({
  senders,
  className,
}: {
  senders: Array<{ name?: string | null; email: string }>;
  className?: string;
}) {
  const visible = senders.slice(0, 4);
  const size: AvatarSize =
    visible.length === 1
      ? "lg"
      : visible.length === 2
        ? "md"
        : visible.length === 3
          ? "sm"
          : "xs";

  return (
    <span className={cn("inline-flex items-center", className)}>
      {visible.map((sender, i) => (
        <ContactAvatar
          key={sender.email}
          name={sender.name}
          email={sender.email}
          size={size}
          className={cn(i > 0 && "-ml-1.5", "ring-2 ring-background")}
        />
      ))}
    </span>
  );
}
