import type { InboxSearchSuggestionsResponse } from "@/features/email/mail/shared/types";

type SearchSuggestionItem = {
  id: string;
  section: string;
  label: string;
  detail?: string | null;
  query: string;
};

export function SearchSuggestionsList({
  query,
  suggestions,
  onSelectQuery,
}: {
  query: string;
  suggestions: InboxSearchSuggestionsResponse;
  onSelectQuery: (query: string) => void;
}) {
  const items: SearchSuggestionItem[] = [
    ...(query
      ? suggestions.contacts.slice(0, 6).map((suggestion) => ({
          id: suggestion.id,
          section: "People",
          label: suggestion.name || suggestion.email,
          detail: suggestion.name ? suggestion.email : null,
          query: suggestion.query,
        }))
      : []),
    ...(query
      ? suggestions.subjects.slice(0, 4).map((suggestion) => ({
          id: suggestion.id,
          section: "Subjects",
          label: suggestion.subject,
          detail: null,
          query: suggestion.query,
        }))
      : []),
    ...suggestions.filters.slice(0, 4).map((suggestion) => ({
      id: suggestion.id,
      section: "Filters",
      label: suggestion.label,
      detail: suggestion.description,
      query: suggestion.query,
    })),
  ];

  if (items.length === 0) return null;

  let previousSection: string | null = null;

  return (
    <div
      role="listbox"
      className="overflow-hidden border border-border bg-background shadow-lg"
    >
      {items.map((item) => {
        const showSection = item.section !== previousSection;
        previousSection = item.section;

        return (
          <div key={item.id}>
            {showSection && (
              <div className="px-2 pb-1 pt-2 text-[10px] font-medium text-muted-foreground">
                {item.section}
              </div>
            )}
            <button
              type="button"
              onClick={() => onSelectQuery(item.query)}
              className="flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
            >
              <span className="min-w-0 truncate">{item.label}</span>
              {item.detail && (
                <span className="max-w-48 truncate text-[11px] text-muted-foreground">
                  {item.detail}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
