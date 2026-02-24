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
import { createProject } from "@/features/workspace/workspace-api";
import { toSlug } from "@/features/workspace/workspace-slug";

type CreateProjectSheetProps = {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CreateProjectSheet(props: CreateProjectSheetProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspace", "projects", props.orgId],
      });
      void router.invalidate();
      setName("");
      setSlug("");
      setFormError(null);
      props.onOpenChange(false);
    },
  });

  useEffect(() => {
    if (!props.open) {
      setName("");
      setSlug("");
      setFormError(null);
    }
  }, [props.open]);

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Create project</SheetTitle>
          <SheetDescription>
            Projects appear in the sidebar and contain your releases.
          </SheetDescription>
        </SheetHeader>

        <form
          className="space-y-3 px-4 pb-4"
          onSubmit={(event) => {
            event.preventDefault();

            const trimmedName = name.trim();
            const normalizedSlug = toSlug(slug || name);
            if (!props.orgId || !trimmedName || !normalizedSlug) {
              setFormError("Project name is required.");
              return;
            }

            setFormError(null);
            createProjectMutation.mutate({
              orgId: props.orgId,
              name: trimmedName,
              slug: normalizedSlug,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => {
                const nextName = event.target.value;
                setName(nextName);
                setSlug(toSlug(nextName));
              }}
              placeholder="Main Product"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-slug">Slug</Label>
            <Input
              id="project-slug"
              value={slug}
              onChange={(event) => setSlug(toSlug(event.target.value))}
              placeholder="main-product"
              required
            />
          </div>

          {(formError || createProjectMutation.error) && (
            <p className="text-xs text-destructive">
              {formError ?? createProjectMutation.error?.message ?? "Failed to create project."}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={createProjectMutation.isPending}>
            {createProjectMutation.isPending ? "Creating project..." : "Create project"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
