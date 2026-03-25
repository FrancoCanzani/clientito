export function EditorHeader({
  title,
  onTitleChange,
}: {
  title: string;
  onTitleChange: (value: string) => void;
}) {
  return (
    <input
      value={title}
      onChange={(event) => onTitleChange(event.target.value)}
      placeholder="Untitled note"
      className="w-full text-2xl font-medium tracking-tight outline-none"
    />
  );
}
