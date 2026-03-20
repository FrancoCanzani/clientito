import { Skeleton } from "@/components/ui/skeleton";
import {
  type Draft,
  deleteDraft,
  fetchDrafts,
} from "@/features/inbox/draft-queries";
import { formatInboxRowDate } from "@/features/inbox/utils/format-inbox-row-date";
import { cn } from "@/lib/utils";
import { PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type DraftListViewProps = {
  onOpenDraft: (draft: Draft) => void;
};

export function DraftListView({ onOpenDraft }: DraftListViewProps) {
  const queryClient = useQueryClient();

  const { data: drafts, isPending, isError } = useQuery({
    queryKey: ["drafts"],
    queryFn: fetchDrafts,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDraft,
    onSuccess: () => {
      toast.success("Draft deleted");
      void queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
    onError: () => toast.error("Failed to delete draft"),
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-4">
      <header className="shrink-0">
        <h2 className="text-lg font-medium">Drafts</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-11 w-full rounded-md animate-in fade-in-0"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: "backwards" }}
              />
            ))}
          </div>
        ) : isError ? (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">
            Failed to load drafts.
          </p>
        ) : drafts && drafts.length > 0 ? (
          <div className="space-y-1 [&:has(>[data-draft-row]:hover)>[data-draft-row]:not(:hover)]:opacity-85">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                data-draft-row
                role="button"
                tabIndex={0}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-[opacity,background-color] duration-200 ease-out hover:bg-muted/40 cursor-default",
                )}
                onClick={() => onOpenDraft(draft)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenDraft(draft);
                  }
                }}
              >
                <PencilSimpleIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />

                <div className="min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm sm:flex">
                  <span className="shrink-0 truncate font-medium text-foreground sm:max-w-52">
                    {draft.to || "(no recipient)"}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {draft.subject || "(no subject)"}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {formatInboxRowDate(draft.updatedAt)}
                  </span>
                  <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground transition-[transform,background-color,color] duration-150 ease-out hover:bg-destructive/10 hover:text-destructive active:scale-95"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteMutation.mutate(draft.id);
                    }}
                    aria-label="Delete draft"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-border/60 p-4 text-center text-sm text-muted-foreground">
            No drafts found.
          </p>
        )}
      </div>
    </div>
  );
}
