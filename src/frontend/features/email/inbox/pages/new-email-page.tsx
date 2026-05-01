import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ComposeEmailFields } from "@/features/email/inbox/components/compose/compose-email-fields";
import { useComposeEmail } from "@/features/email/inbox/components/compose/compose-email-state";
import { XIcon } from "@phosphor-icons/react";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/new");

export default function NewEmailPage() {
  const { mailboxId } = route.useParams();
  const { composeKey } = route.useSearch();
  const navigate = route.useNavigate();

  const initialCompose = useMemo(
    () => ({
      mailboxId,
      composeKey,
    }),
    [composeKey, mailboxId],
  );

  const compose = useComposeEmail(
    initialCompose,
    {
      onSent: () => {
        navigate({
          to: "/$mailboxId/inbox",
          params: { mailboxId },
          replace: true,
        });
      },
    }
  );

  const navigateBack = () =>
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
    });

  const handleDiscard = async () => {
    await compose.clearDraft();
    navigateBack();
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <span>New Email</span>
          </div>
        }
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={navigateBack}
            aria-label="Close full composer"
          >
            <XIcon className="size-3.5" />
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-4xl min-h-0 flex-1 flex-col flex">
        <ComposeEmailFields
          compose={compose}
          bodyClassName="flex-1 text-sm leading-relaxed"
          onEscape={navigateBack}
          onDiscard={() => {
            void handleDiscard();
          }}
          recipientAutoFocus={compose.to.trim().length === 0}
          editorAutoFocus={compose.to.trim().length > 0}
        />
      </div>
    </div>
  );
}
