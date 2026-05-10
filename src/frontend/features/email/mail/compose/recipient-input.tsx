import { fetchContactSuggestions } from "@/features/email/mail/data/contacts";
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

function parseRecipients(raw: string): string[] {
 return raw
 .split(",")
 .flatMap((s) => {
 const recipient = s.trim();
 return recipient ? [recipient] : [];
 });
}

function parseEmailAddressesFromString(raw: string): string[] {
 const matches: string[] = [];
 for (const match of raw.matchAll(
 /<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/gi,
 )) {
 const email = match[1]?.trim();
 if (email) matches.push(email);
 }

 if (matches.length > 0) {
 return matches;
 }

 return raw
 .split(/[\n,;\s]+/)
 .flatMap((part) => {
 const email = part.trim();
 return email && emailSchema.safeParse(email).success ? [email] : [];
 });
}

function dedupeRecipients(emails: string[]): string[] {
 const seen = new Set<string>();
 const deduped: string[] = [];

 for (const email of emails) {
 const normalized = email.trim();
 const key = normalized.toLowerCase();
 if (!normalized || seen.has(key)) continue;
 seen.add(key);
 deduped.push(normalized);
 }

 return deduped;
}

function joinRecipients(emails: string[]): string {
 return emails.join(", ");
}

function formatRecipientLabel(email: string, name?: string | null): string {
 const trimmedName = name?.trim();
 if (!trimmedName) return email;
 return `${trimmedName} <${email}>`;
}

function estimateChipWidth(label: string): number {
 return Math.min(label.length, 48) * 7 + 26;
}

function buildCollapsedPreview(labels: string[], containerWidth: number): string {
 if (labels.length === 0) return "";
 if (containerWidth <= 0) {
 const remaining = Math.max(labels.length - 1, 0);
 return remaining > 0 ? `${labels[0]} +${remaining} more` : labels[0];
 }

 const allowance = Math.max(120, containerWidth - 20);
 let used = 0;
 let visibleCount = 0;

 for (const label of labels) {
 const next = estimateChipWidth(label);
 if (visibleCount > 0 && used + next > allowance) {
 break;
 }
 used += next;
 visibleCount += 1;
 }

 const visible = labels.slice(0, Math.max(visibleCount, 1));
 const hiddenCount = Math.max(labels.length - visible.length, 0);
 const base = visible.join(", ");

 return hiddenCount > 0 ? `${base} +${hiddenCount} more` : base;
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
 const chips = useMemo(() => parseRecipients(value), [value]);
 const [inputValue, setInputValue] = useState("");
 const [open, setOpen] = useState(false);
 const [selectedIndex, setSelectedIndex] = useState(0);
 const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
 const [isInputFocused, setIsInputFocused] = useState(Boolean(autoFocus));
 const [editingIndex, setEditingIndex] = useState<number | null>(null);
 const [editingValue, setEditingValue] = useState("");
 const [containerWidth, setContainerWidth] = useState(0);
 const containerRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLInputElement>(null);
 const editingInputRef = useRef<HTMLInputElement>(null);

 const [debouncedInput] = useDebounce(inputValue, 100);
 const debouncedQuery = debouncedInput.trim();

 const { data } = useQuery({
 queryKey: ["contact-suggestions", mailboxId ?? "all-mailboxes", debouncedQuery],
 queryFn: () => fetchContactSuggestions(debouncedQuery, 8, mailboxId ?? undefined),
 enabled: debouncedQuery.length >= 1,
 staleTime: 30_000,
 gcTime: 60_000,
 });

 const suggestions = data ?? [];
 const activeIndex = Math.min(
 selectedIndex,
 Math.max(suggestions.length - 1, 0),
 );
 const showDropdown =
 open &&
 editingIndex === null &&
 suggestions.length > 0 &&
 inputValue.trim().length >= 1;

 const chipLabels = useMemo(
 () =>
 chips.map((email) =>
 formatRecipientLabel(email, nameMap.get(email)),
 ),
 [chips, nameMap],
 );
 const collapsedPreview = useMemo(
 () => buildCollapsedPreview(chipLabels, containerWidth),
 [chipLabels, containerWidth],
 );
 const showCollapsedPreview =
 !isInputFocused &&
 editingIndex === null &&
 inputValue.length === 0 &&
 chips.length > 0;

 const advanceFocus = () => {
 onAdvanceFocus?.();
 };

 const setRecipients = useCallback(
 (nextRecipients: string[]) => {
 onChange(joinRecipients(dedupeRecipients(nextRecipients)));
 },
 [onChange],
 );

 const commitEmail = useCallback(
 (email: string, name?: string | null) => {
 const trimmed = email.trim();
 if (!trimmed) {
 setInputValue("");
 return;
 }
 if (!emailSchema.safeParse(trimmed).success) return;
 if (name) {
 setNameMap((prev) => new Map(prev).set(trimmed, name));
 }
 setRecipients([...chips, trimmed]);
 setInputValue("");
 setOpen(false);
 setSelectedIndex(0);
 },
 [chips, setRecipients],
 );

 const removeChip = useCallback(
 (index: number) => {
 setRecipients(chips.filter((_, i) => i !== index));
 if (editingIndex === index) {
 setEditingIndex(null);
 setEditingValue("");
 }
 },
 [chips, editingIndex, setRecipients],
 );

 const commitEditedChip = useCallback(
 (index: number, rawValue: string) => {
 const trimmed = rawValue.trim();
 if (!trimmed) {
 removeChip(index);
 return;
 }
 if (!emailSchema.safeParse(trimmed).success) {
 setEditingIndex(null);
 setEditingValue("");
 return;
 }

 const next = chips.map((chip, i) => (i === index ? trimmed : chip));
 setRecipients(next);
 setEditingIndex(null);
 setEditingValue("");
 },
 [chips, removeChip, setRecipients],
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

 const handleInputPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
 const raw = event.clipboardData.getData("text/plain");
 const parsed = parseEmailAddressesFromString(raw);
 if (parsed.length === 0) {
 return;
 }

 event.preventDefault();
 setRecipients([...chips, ...parsed]);
 setInputValue("");
 setOpen(false);
 setSelectedIndex(0);
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (editingIndex !== null) {
 return;
 }

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
 setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
 return;
 }
 if (e.key === "Enter" && suggestions[activeIndex]) {
 e.preventDefault();
 commitEmail(
 suggestions[activeIndex].email,
 suggestions[activeIndex].name,
 );
 return;
 }
 if (e.key === "Tab" && suggestions[activeIndex]) {
 e.preventDefault();
 commitEmail(
 suggestions[activeIndex].email,
 suggestions[activeIndex].name,
 );
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

 const commitInputOnBlur = () => {
 if (inputValue.trim()) commitEmail(inputValue);
 setTimeout(() => {
 setOpen(false);
 setIsInputFocused(false);
 }, 120);
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

 useEffect(() => {
 if (!containerRef.current || typeof ResizeObserver === "undefined") {
 return;
 }

 const observer = new ResizeObserver((entries) => {
 const entry = entries[0];
 if (!entry) return;
 setContainerWidth(entry.contentRect.width);
 });

 observer.observe(containerRef.current);
 return () => observer.disconnect();
 }, []);

 useEffect(() => {
 if (!isFocused) return;
 setIsInputFocused(true);
 setOpen(true);
 onFocusField?.();
 requestAnimationFrame(() => inputRef.current?.focus());
 }, [isFocused, onFocusField]);

 useEffect(() => {
 if (!showDropdown) return;
 const selector = `[data-suggestion-index="${activeIndex}"]`;
 const target = containerRef.current?.querySelector(selector);
 if (!(target instanceof HTMLElement)) return;
 target.scrollIntoView({ block: "nearest" });
 }, [activeIndex, showDropdown]);

 useEffect(() => {
 if (editingIndex === null) return;
 requestAnimationFrame(() => editingInputRef.current?.focus());
 }, [editingIndex]);

 return (
 <div ref={containerRef} className="relative w-full">
 <div
 className="flex max-h-24 flex-wrap items-center gap-1 overflow-y-auto"
 onClick={() => {
 setIsInputFocused(true);
 setOpen(true);
 onFocusField?.();
 inputRef.current?.focus();
 }}
 >
 {showCollapsedPreview ? (
 <button
 type="button"
 aria-label={`Edit ${chips.length} ${placeholder} recipient${chips.length === 1 ? "" : "s"}`}
 className="max-w-full truncate px-0.5 py-1 text-left text-xs text-muted-foreground/80 transition-colors hover:text-foreground"
 onClick={() => {
 setIsInputFocused(true);
 setOpen(true);
 onFocusField?.();
 requestAnimationFrame(() => inputRef.current?.focus());
 }}
 >
 {collapsedPreview}
 </button>
 ) : (
 chips.map((email, i) => {
 const displayName = nameMap.get(email);
 const displayLabel = formatRecipientLabel(email, displayName);
 const isEditing = editingIndex === i;

 return (
 <span
 key={email}
 className="group/chip inline-flex h-5 max-w-72 items-center gap-1 bg-primary/10 py-0 pr-0.5 pl-1.5 text-[11px] text-foreground/90 ring-1 ring-primary/15 transition-colors hover:bg-primary/15"
 title={email}
 >
 {isEditing ? (
 <input
 ref={editingInputRef}
 type="text"
 value={editingValue}
 onChange={(event) => setEditingValue(event.target.value)}
 onBlur={() => commitEditedChip(i, editingValue)}
 onKeyDown={(event) => {
 if (event.key === "Enter" || event.key === "Tab") {
 event.preventDefault();
 commitEditedChip(i, editingValue);
 }
 if (event.key === "Escape") {
 event.preventDefault();
 setEditingIndex(null);
 setEditingValue("");
 }
 }}
 className="min-w-10 max-w-36 bg-transparent text-xs outline-none"
 />
 ) : (
 <button
 type="button"
 className="max-w-64 truncate text-left"
 onMouseDown={(event) => event.preventDefault()}
 onClick={(event) => {
 event.stopPropagation();
 setEditingIndex(i);
 setEditingValue(email);
 setOpen(false);
 }}
 >
 {displayLabel}
 </button>
 )}
 <button
 type="button"
 aria-label={`Remove ${displayLabel}`}
 className="ml-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground/70 transition-colors hover:bg-primary/20 hover:text-foreground"
 onMouseDown={(event) => event.preventDefault()}
 onClick={(event) => {
 event.stopPropagation();
 removeChip(i);
 }}
 tabIndex={-1}
 >
 <XIcon className="size-2" />
 </button>
 </span>
 );
 })
 )}

 <input
 ref={inputRef}
 type="text"
 placeholder={chips.length === 0 ? placeholder : ""}
 aria-label={placeholder}
 value={inputValue}
 onChange={handleInputChange}
 onFocus={() => {
 setIsInputFocused(true);
 setOpen(true);
 onFocusField?.();
 }}
 onBlur={commitInputOnBlur}
 onKeyDown={handleKeyDown}
 onPaste={handleInputPaste}
 autoFocus={autoFocus}
 className={`min-w-20 flex-1 bg-transparent py-1 text-[11px] outline-none placeholder:text-muted-foreground/50 ${showCollapsedPreview ? "sr-only" : ""} ${inputClassName ?? ""}`}
 />
 </div>

 {showDropdown && (
 <div className="absolute top-full left-0 z-50 mt-1 w-full max-h-44 overflow-y-auto border border-border bg-popover shadow-sm">
 {suggestions.map((suggestion, i) => (
 <button
 key={suggestion.email}
 type="button"
 data-suggestion-index={i}
 className={`flex w-full items-center gap-2 px-2 py-1 text-left text-xs transition-colors ${
 i === activeIndex ? "bg-muted" : "hover:bg-muted/50"
 }`}
 onMouseDown={(e) => e.preventDefault()}
 onClick={() => {
 commitEmail(suggestion.email, suggestion.name);
 }}
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
