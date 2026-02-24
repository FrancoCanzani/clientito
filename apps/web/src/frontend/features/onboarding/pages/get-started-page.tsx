import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import CreateOrganizationSheet from "@/features/workspace/components/create-organization-sheet";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export default function GetStartedPage() {
  const navigate = useNavigate();
  const [isOrgSheetOpen, setIsOrgSheetOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <CreateOrganizationSheet
        open={isOrgSheetOpen}
        onOpenChange={setIsOrgSheetOpen}
        onCreated={(orgId) => {
          navigate({
            to: "/$orgId/projects",
            params: { orgId: orgId },
          });
        }}
      />

      <Empty className="border-border bg-card py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sparkles />
          </EmptyMedia>
          <EmptyTitle>Welcome, let&apos;s set up your workspace</EmptyTitle>
          <EmptyDescription>
            You&apos;re signed in. Create your first organization to unlock
            project creation and the releases workspace.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Button type="button" onClick={() => setIsOrgSheetOpen(true)}>
            Create organization
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
