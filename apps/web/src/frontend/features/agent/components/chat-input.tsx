import {
  EnvelopeIcon,
  HouseSimpleIcon,
  PaperPlaneRightIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useRef } from "react";

export function ChatInput({
  orgId,
  input,
  onInputChange,
  onSubmit,
  onFocus,
  isLoading,
}: {
  orgId: string;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onFocus: () => void;
  isLoading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border-t bg-background px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 shrink-0">
          <Link
            to="/$orgId"
            params={{ orgId }}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
            title="Home"
          >
            <HouseSimpleIcon className="size-4" />
          </Link>
          <Link
            to="/$orgId/customers"
            params={{ orgId }}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
            title="Customers"
          >
            <UsersIcon className="size-4" />
          </Link>
          <Link
            to="/$orgId/emails"
            params={{ orgId }}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
            title="Emails"
          >
            <EnvelopeIcon className="size-4" />
          </Link>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => onInputChange?.(e.target.value)}
            onFocus={onFocus}
            placeholder="Ask anything..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-md p-1.5 hover:bg-muted transition-colors disabled:opacity-40"
          >
            <PaperPlaneRightIcon className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
