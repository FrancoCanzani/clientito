import { fetchContactSuggestions } from "@/features/email/inbox/queries";
import { XIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { z } from "zod";

const emailSchema = z.email();

type RecipientInputProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  inputClassName?: string;
};

function parseRecipients(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinRecipients(emails: string[]): string {
  return emails.join(", ");
}

export function RecipientInput({
  value,
  onChange,
  autoFocus,
  placeholder = "To",
  inputClassName,
}: RecipientInputProps) {
  const chips = parseRecipients(value);
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [debouncedInput] = useDebounce(inputValue, 100);
  const debouncedQuery = debouncedInput.length >= 2 ? debouncedInput : "";

  const { data } = useQuery({
    queryKey: ["contact-suggestions", debouncedQuery],
    queryFn: () => fetchContactSuggestions(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const suggestions = data ?? [];
  const activeIndex = Math.min(
    selectedIndex,
    Math.max(suggestions.length - 1, 0),
  );
  const showDropdown = open && suggestions.length > 0 && inputValue.length >= 2;

  const commitEmail = useCallback(
    (email: string, name?: string | null) => {
      const trimmed = email.trim();
      if (!trimmed || chips.includes(trimmed)) {
        setInputValue("");
        return;
      }
      if (!emailSchema.safeParse(trimmed).success) return;
      if (name) {
        setNameMap((prev) => new Map(prev).set(trimmed, name));
      }
      onChange(joinRecipients([...chips, trimmed]));
      setInputValue("");
      setOpen(false);
      setSelectedIndex(0);
    },
    [chips, onChange],
  );

  const removeChip = useCallback(
    (index: number) => {
      onChange(joinRecipients(chips.filter((_, i) => i !== index)));
    },
    [chips, onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (next.includes(",")) {
      const parts = next.split(",");
      for (const part of parts.slice(0, -1)) {
        if (part.trim()) commitEmail(part.trim());
      }
      setInputValue(parts[parts.length - 1]);
      return;
    }
    setInputValue(next);
    setOpen(true);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && inputValue === "" && chips.length > 0) {
      removeChip(chips.length - 1);
      return;
    }

    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && suggestions[activeIndex]) {
        e.preventDefault();
        commitEmail(
          suggestions[activeIndex].email,
          suggestions[activeIndex].name,
        );
        return;
      }
    }

    if ((e.key === "Enter" || e.key === "Tab") && inputValue.trim()) {
      e.preventDefault();
      commitEmail(inputValue);
    }

    if (e.key === "Escape") setOpen(false);
  };

  const handleBlur = () => {
    if (inputValue.trim()) commitEmail(inputValue);
    setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className="flex max-h-24 flex-wrap items-center gap-1 overflow-y-auto"
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map((email, i) => {
          const displayName = nameMap.get(email);
          return (
            <span
              key={`${email}-${i}`}
              className="flex max-w-48 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
              title={email}
            >
              <span className="truncate">{displayName ?? email}</span>
              <button
                type="button"
                className="shrink-0 text-muted-foreground/60 hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  removeChip(i);
                }}
                tabIndex={-1}
              >
                <XIcon className="size-2.5" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          placeholder={chips.length === 0 ? placeholder : ""}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          className={`min-w-20 flex-1 bg-transparent py-1 text-xs outline-none placeholder:text-muted-foreground/50 ${inputClassName ?? ""}`}
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {suggestions.map((suggestion, i) => (
            <button
              key={suggestion.email}
              type="button"
              className={`flex w-full items-center gap-2 px-2 py-1 text-left text-xs transition-colors ${
                i === activeIndex ? "bg-muted" : "hover:bg-muted/50"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitEmail(suggestion.email, suggestion.name)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">
                  {suggestion.name ?? suggestion.email}
                </div>
                {suggestion.name && (
                  <div className="truncate text-xs text-muted-foreground">
                    {suggestion.email}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
