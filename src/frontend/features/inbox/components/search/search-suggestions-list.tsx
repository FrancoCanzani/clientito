import { Button } from "@/components/ui/button";
import type { InboxSearchSuggestionsResponse } from "@/features/inbox/types";

export function SearchSuggestionsList({
  query,
  suggestions,
  onSelectQuery,
}: {
  query: string;
  suggestions: InboxSearchSuggestionsResponse;
  onSelectQuery: (query: string) => void;
}) {
  const topFilters = suggestions.filters.slice(0, 4);
  const topContacts = query ? suggestions.contacts.slice(0, 6) : [];
  const topSubjects = query ? suggestions.subjects.slice(0, 4) : [];
  const hasAny =
    topFilters.length > 0 || topContacts.length > 0 || topSubjects.length > 0;

  if (!hasAny) {
    return;
  }

  return (
    <div className="space-y-4">
      {topFilters.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Try</p>
          <div className="flex flex-wrap gap-2">
            {topFilters.map((suggestion) => (
              <Button
                key={suggestion.id}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onSelectQuery(suggestion.query)}
              >
                <span className="max-w-56 truncate">{suggestion.query}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {topContacts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">People</p>
          <div className="flex flex-wrap gap-2">
            {topContacts.map((suggestion) => (
              <Button
                key={suggestion.id}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onSelectQuery(suggestion.query)}
              >
                <span className="max-w-48 truncate">
                  {suggestion.name || suggestion.email}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {topSubjects.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Recent subjects</p>
          <div className="flex flex-wrap gap-2">
            {topSubjects.map((suggestion) => (
              <Button
                key={suggestion.id}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onSelectQuery(suggestion.query)}
              >
                <span className="max-w-[18rem] truncate">
                  {suggestion.subject}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
