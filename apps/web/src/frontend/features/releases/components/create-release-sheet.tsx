import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createRelease } from "@/features/releases/api/release-api";

type CreateReleaseSheetProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CreateReleaseSheet(props: CreateReleaseSheetProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createRelease,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["releases", props.projectId] });
      void router.invalidate();
      setTitle("");
      setVersion("");
      setFormError(null);
      props.onOpenChange(false);
    },
  });

  useEffect(() => {
    if (!props.open) {
      setTitle("");
      setVersion("");
      setFormError(null);
    }
  }, [props.open]);

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Create release</SheetTitle>
          <SheetDescription>
            Start a new release draft. You can add items and notes later.
          </SheetDescription>
        </SheetHeader>

        <form
          className="space-y-3 px-4 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmedTitle = title.trim();
            if (!trimmedTitle) {
              setFormError("Title is required.");
              return;
            }
            setFormError(null);
            mutation.mutate({
              projectId: props.projectId,
              title: trimmedTitle,
              version: version.trim() || undefined,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="release-title">Title</Label>
            <Input
              id="release-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="v1.0.0 Release"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="release-version">Version (optional)</Label>
            <Input
              id="release-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
            />
          </div>

          {(formError || mutation.error) && (
            <p className="text-xs text-destructive">
              {formError ?? mutation.error?.message ?? "Failed to create release."}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create release"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
