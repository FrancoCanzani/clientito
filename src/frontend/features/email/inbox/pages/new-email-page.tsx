import { Button } from "@/components/ui/button";
import { ComposeEmailFields } from "@/features/email/mail/compose/compose-email-fields";
import { useComposeEmail } from "@/features/email/mail/compose/compose-email-state";
import {
  MailboxPage,
  MailboxPageBody,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
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
    <MailboxPage>
      <MailboxPageHeader
        title="New Email"
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

      <MailboxPageBody className="overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
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
      </MailboxPageBody>
    </MailboxPage>
  );
}
