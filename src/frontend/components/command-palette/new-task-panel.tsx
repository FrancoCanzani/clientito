import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewTaskPanel({
  taskInput,
  setTaskInput,
  onSubmit,
  onBack,
  isPending,
}: {
  taskInput: string;
  setTaskInput: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-2 p-3">
      <p className="text-xs text-muted-foreground">Create task</p>
      <Input
        value={taskInput}
        onChange={(event) => setTaskInput(event.target.value)}
        placeholder="e.g. Send proposal tomorrow 3pm"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={isPending || taskInput.trim().length === 0}
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
