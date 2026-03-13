import { toast } from "sonner";

export type EmailSuggestion = {
  id: number;
  emailId: number;
  actionType: "add_task" | "draft_reply" | "archive" | "follow_up";
  label: string;
  params: Record<string, unknown> | null;
  status: string;
  createdAt: number;
};

type SuggestionToastProps = {
  toastId: string | number;
  senderName: string;
  subject: string;
  suggestions: EmailSuggestion[];
  onExecute: (suggestionId: number) => void;
  onDismiss: (suggestionId: number) => void;
};

export function SuggestionToast({
  toastId,
  senderName,
  subject,
  suggestions,
  onExecute,
  onDismiss,
}: SuggestionToastProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{senderName}</p>
        <p className="text-xs text-muted-foreground truncate">{subject}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onExecute(suggestion.id);
              toast.dismiss(toastId);
            }}
          >
            {suggestion.label}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto inline-flex items-center rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => {
            for (const s of suggestions) {
              onDismiss(s.id);
            }
            toast.dismiss(toastId);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
