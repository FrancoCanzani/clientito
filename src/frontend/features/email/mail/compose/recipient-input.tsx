import { fetchContactSuggestions } from "@/features/email/mail/shared/data/contacts";
import { XIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { z } from "zod";

const emailSchema = z.email();

type RecipientInputProps = {
 value: string;
 onChange: (value: string) => void;
 autoFocus?: boolean;
 placeholder?: string;
 inputClassName?: string;
 isFocused?: boolean;
 onFocusField?: () => void;
 onAdvanceFocus?: () => void;
};

function parseRecipientsFromString(raw: string): string[] {
 return raw
 .split(",")
 .map((s) => s.trim())
 .filter(Boolean);
}

function extractEmailsFromText(raw: string): {
 valid: string[];
 invalid: string[];
} {
 const valid: string[] = [];
 const invalid: string[] = [];

 const withBrackets = Array.from(
 raw.matchAll(/<([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>/gi),
 ).map((m) => m[1]!.trim());
 if (withBrackets.length > 0) {
 return { valid: withBrackets, invalid: [] };
 }

 const parts = raw
 .split(/[\n,;\s]+/)
 .map((part) => part.trim())
 .filter(Boolean);

 for (const part of parts) {
 if (emailSchema.safeParse(part).success) valid.push(part);
 else invalid.push(part);
 }

 return { valid, invalid };
}

function dedupeEmails(emails: string[]): string[] {
 const seen = new Set<string>();
 const result: string[] = [];
 for (const email of emails) {
 const key = email.trim().toLowerCase();
 if (!key || seen.has(key)) continue;
 seen.add(key);
 result.push(email.trim());
 }
 return result;
}

function formatRecipientLabel(email: string, name?: string | null): string {
 const trimmedName = name?.trim();
 if (!trimmedName || trimmedName === email) return email;
 return `${trimmedName} <${email}>`;
}

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

export function RecipientInput({
 value,
 onChange,
 autoFocus,
 placeholder = "To",
 inputClassName,
 isFocused,
 onFocusField,
 onAdvanceFocus,
}: RecipientInputProps) {
 const { mailboxId } = mailboxRoute.useParams();

 const [chips, setChips] = useState<string[]>(() =>
 parseRecipientsFromString(value),
 );
 const [inputValue, setInputValue] = useState("");
 const [open, setOpen] = useState(false);
 const [selectedIndex, setSelectedIndex] = useState(0);
 const nameMapRef = useRef<Map<string, string>>(new Map());
 const inputRef = useRef<HTMLInputElement>(null);
 const containerRef = useRef<HTMLDivElement>(null);
 const lastEmittedRef = useRef(value);

 useEffect(() => {
 const incoming = parseRecipientsFromString(value);
 if (value === lastEmittedRef.current) return;
 setChips(dedupeEmails(incoming));
 }, [value]);

 useEffect(() => {
 const next = chips.join(", ");
 if (next === lastEmittedRef.current) return;
 lastEmittedRef.current = next;
 onChange(next);
 }, [chips, onChange]);

 const [debouncedInput] = useDebounce(inputValue, 80);
 const debouncedQuery = debouncedInput.trim();

 const { data } = useQuery({
 queryKey: [
 "contact-suggestions",
 mailboxId ?? "all-mailboxes",
 debouncedQuery,
 ],
 queryFn: () =>
 fetchContactSuggestions(debouncedQuery, 8, mailboxId ?? undefined),
 enabled: debouncedQuery.length >= 1,
 staleTime: 5 * 60_000,
 gcTime: 10 * 60_000,
 });

 const suggestions = useMemo(() => {
 const list = data ?? [];
 const chipSet = new Set(chips.map((c) => c.toLowerCase()));
 return list.filter((s) => !chipSet.has(s.email.toLowerCase()));
 }, [data, chips]);

 const activeIndex = Math.min(
 selectedIndex,
 Math.max(suggestions.length - 1, 0),
 );
 const showDropdown =
 open && suggestions.length > 0 && inputValue.trim().length >= 1;

 const addChips = useCallback((emails: string[]) => {
 if (emails.length === 0) return;
 setChips((current) => dedupeEmails([...current, ...emails]));
 }, []);

 const commitEmail = useCallback(
 (email: string, name?: string | null) => {
 const trimmed = email.trim();
 if (!trimmed) return;
 if (!emailSchema.safeParse(trimmed).success) return;
 if (name) nameMapRef.current.set(trimmed, name);
 addChips([trimmed]);
 setInputValue("");
 setOpen(false);
 setSelectedIndex(0);
 },
 [addChips],
 );

 const removeChip = useCallback((index: number) => {
 setChips((current) => current.filter((_, i) => i !== index));
 }, []);

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const next = e.target.value;
 if (next.includes(",")) {
 const parts = next.split(",");
 for (const part of parts.slice(0, -1)) {
 const trimmed = part.trim();
 if (trimmed && emailSchema.safeParse(trimmed).success) {
 commitEmail(trimmed);
 }
 }
 setInputValue(parts[parts.length - 1]);
 return;
 }
 setInputValue(next);
 setOpen(true);
 setSelectedIndex(0);
 };

 const handleInputPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
 const raw = event.clipboardData.getData("text/plain");
 if (!/[\n,;]/.test(raw) && !raw.includes("<")) return;

 const { valid, invalid } = extractEmailsFromText(raw);
 if (valid.length === 0 && invalid.length === 0) return;

 event.preventDefault();
 addChips(valid);
 setInputValue(invalid.join(", "));
 setOpen(false);
 setSelectedIndex(0);
 };

 const advanceFocus = () => onAdvanceFocus?.();

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
 if (e.key === "Enter" && suggestions[activeIndex]) {
 e.preventDefault();
 commitEmail(suggestions[activeIndex].email, suggestions[activeIndex].name);
 return;
 }
 if (e.key === "Tab" && suggestions[activeIndex]) {
 e.preventDefault();
 commitEmail(suggestions[activeIndex].email, suggestions[activeIndex].name);
 advanceFocus();
 return;
 }
 }

 if (e.key === "Enter" && inputValue.trim()) {
 e.preventDefault();
 commitEmail(inputValue);
 return;
 }
 if (e.key === "Tab" && inputValue.trim()) {
 e.preventDefault();
 commitEmail(inputValue);
 advanceFocus();
 return;
 }
 if (e.key === "Escape") setOpen(false);
 };

 const handleInputBlur = () => {
 if (inputValue.trim() && emailSchema.safeParse(inputValue.trim()).success) {
 commitEmail(inputValue);
 }
 setTimeout(() => setOpen(false), 120);
 };

 useEffect(() => {
 if (!open) return;
 const onClick = (e: MouseEvent) => {
 if (
 containerRef.current &&
 e.target instanceof Node &&
 !containerRef.current.contains(e.target)
 ) {
 setOpen(false);
 }
 };
 document.addEventListener("mousedown", onClick);
 return () => document.removeEventListener("mousedown", onClick);
 }, [open]);

 useEffect(() => {
 if (!isFocused) return;
 setOpen(true);
 onFocusField?.();
 requestAnimationFrame(() => inputRef.current?.focus());
 }, [isFocused, onFocusField]);

 useEffect(() => {
 if (!showDropdown) return;
 const target = containerRef.current?.querySelector(
 `[data-suggestion-index="${activeIndex}"]`,
 );
 if (target instanceof HTMLElement) {
 target.scrollIntoView({ block: "nearest" });
 }
 }, [activeIndex, showDropdown]);

 return (
 <div ref={containerRef} className="relative w-full">
 <div
 className="flex max-h-24 flex-wrap items-center gap-1 overflow-y-auto"
 onClick={() => {
 onFocusField?.();
 inputRef.current?.focus();
 }}
 >
 {chips.map((email, i) => {
 const displayName = nameMapRef.current.get(email);
 const displayLabel = formatRecipientLabel(email, displayName);
 return (
 <span
 key={`${email}-${i}`}
 className="inline-flex h-5 max-w-72 items-center gap-1 bg-primary/10 py-0 pr-0.5 pl-1.5 text-[11px] text-foreground/90 ring-1 ring-primary/15"
 title={email}
 >
 <span className="max-w-64 truncate">{displayLabel}</span>
 <button
 type="button"
 aria-label={`Remove ${displayLabel}`}
 className="ml-0.5 flex size-4 shrink-0 items-center justify-center text-foreground/60 hover:bg-primary/25 hover:text-foreground"
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
 aria-label={placeholder}
 value={inputValue}
 onChange={handleInputChange}
 onFocus={() => {
 setOpen(true);
 onFocusField?.();
 }}
 onBlur={handleInputBlur}
 onKeyDown={handleKeyDown}
 onPaste={handleInputPaste}
 autoFocus={autoFocus}
 className={`min-w-20 flex-1 bg-transparent py-1 text-[11px] outline-none placeholder:text-muted-foreground/50 ${inputClassName ?? ""}`}
 />
 </div>

 {showDropdown && (
 <div className="absolute top-full left-0 z-50 mt-1 max-h-44 w-full overflow-y-auto border border-border bg-popover shadow-sm">
 {suggestions.map((suggestion, i) => (
 <button
 key={suggestion.email}
 type="button"
 data-suggestion-index={i}
 className={`flex w-full items-center gap-2 px-2 py-1 text-left text-xs transition-colors ${
 i === activeIndex ? "bg-muted" : "hover:bg-muted/50"
 }`}
 onMouseDown={(e) => e.preventDefault()}
 onClick={() => commitEmail(suggestion.email, suggestion.name)}
 onMouseEnter={() => setSelectedIndex(i)}
 >
 <div className="min-w-0 flex-1">
 <div className="truncate text-[11px]">
 {formatRecipientLabel(suggestion.email, suggestion.name)}
 </div>
 </div>
 </button>
 ))}
 </div>
 )}
 </div>
 );
}
