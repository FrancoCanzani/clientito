import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
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
import { createOrganization } from "@/features/workspace/workspace-api";
import { toSlug } from "@/features/workspace/workspace-slug";

type CreateOrganizationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (orgId: string) => void;
};

export default function CreateOrganizationSheet(props: CreateOrganizationSheetProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createOrgMutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["workspace", "orgs"] });
      void router.invalidate();

      if (result.data?.id) {
        props.onCreated?.(result.data.id);
      }

      props.onOpenChange(false);
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      const slug = toSlug(value.slug || value.name);

      if (!name || !slug) {
        setSubmitError("Organization name is required.");
        return;
      }

      setSubmitError(null);
      await createOrgMutation.mutateAsync({ name, slug });
    },
  });

  useEffect(() => {
    if (!props.open) {
      form.reset();
      setSubmitError(null);
    }
  }, [form, props.open]);

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Create organization</SheetTitle>
          <SheetDescription>
            Organizations hold your projects. You can switch active organization anytime.
          </SheetDescription>
        </SheetHeader>

        <form
          className="space-y-3 px-4 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field
            name="name"
            children={(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    field.handleChange(nextName);

                    const currentSlug = form.getFieldValue("slug");
                    if (!currentSlug) {
                      form.setFieldValue("slug", toSlug(nextName));
                    }
                  }}
                  placeholder="Acme Labs"
                  required
                />
              </div>
            )}
          />

          <form.Field
            name="slug"
            children={(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="org-slug">Slug</Label>
                <Input
                  id="org-slug"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(toSlug(event.target.value))}
                  placeholder="acme-labs"
                  required
                />
              </div>
            )}
          />

          {(submitError || createOrgMutation.error) && (
            <p className="text-xs text-destructive">
              {submitError ?? createOrgMutation.error?.message ?? "Failed to create organization."}
            </p>
          )}

          <form.Subscribe
            selector={(state) => ({
              isSubmitting: state.isSubmitting,
            })}
            children={({ isSubmitting }) => (
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || createOrgMutation.isPending}
              >
                {isSubmitting || createOrgMutation.isPending
                  ? "Creating organization..."
                  : "Create organization"}
              </Button>
            )}
          />
        </form>
      </SheetContent>
    </Sheet>
  );
}
