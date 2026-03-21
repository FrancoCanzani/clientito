import { fetchContactSuggestions } from "@/features/inbox/queries";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";

type RecipientInputProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  inputClassName?: string;
};

export function RecipientInput({
  value,
  onChange,
  autoFocus,
  placeholder = "To",
  inputClassName,
}: RecipientInputProps) {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [debouncedValue] = useDebounce(value, 200);
  const debouncedQuery = debouncedValue.length >= 2 ? debouncedValue : "";

  const { data } = useQuery({
    queryKey: ["contact-suggestions", debouncedQuery],
    queryFn: () => fetchContactSuggestions(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const suggestions = data?.data ?? [];
  const activeSuggestionIndex =
    suggestions.length > 0
      ? Math.min(selectedIndex, suggestions.length - 1)
      : 0;

  const selectSuggestion = useCallback(
    (email: string) => {
      onChange(email);
      setOpen(false);
      setSelectedIndex(0);
    },
    [onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    onChange(next);
    setOpen(true);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (i) => (i - 1 + suggestions.length) % suggestions.length,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (suggestions[activeSuggestionIndex]) {
        e.preventDefault();
        selectSuggestion(suggestions[activeSuggestionIndex].email);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Don't show dropdown if the input looks like a complete email already selected
  const looksLikeCompleteEmail =
    value.includes("@") && value.includes(".");
  const showDropdown =
    open && suggestions.length > 0 && !looksLikeCompleteEmail;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="email"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${inputClassName ?? ""}`}
      />
      {showDropdown && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover">
          {suggestions.map((suggestion, i) => (
            <button
              key={suggestion.email}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                i === activeSuggestionIndex ? "bg-muted" : "hover:bg-muted/50"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(suggestion.email)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase text-muted-foreground">
                {suggestion.name?.[0] ?? suggestion.email[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
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
