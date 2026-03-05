export function EditorHeader({
  title,
  onTitleChange,
  isSaving,
  saveState,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  isSaving: boolean;
  saveState: "idle" | "saved" | "error";
}) {
  return (
    <div className="w-full flex items-center justify-between">
      <input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Untitled note"
        className="flex-1 text-2xl font-medium tracking-tight outline-none"
      />
      <span className="text-xs text-muted-foreground">
        {isSaving
          ? "Saving..."
          : saveState === "saved"
            ? "Saved"
            : saveState === "error"
              ? "Save failed"
              : ""}
      </span>
    </div>
  );
}
