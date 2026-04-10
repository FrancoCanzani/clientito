import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ComposeEmailFields } from "@/features/email/inbox/components/compose-email-fields";
import { useComposeEmail } from "@/features/email/inbox/components/compose-email-state";
import { useSetPageContext } from "@/hooks/use-page-context";
import { XIcon } from "@phosphor-icons/react";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/new");

export default function NewEmailPage() {
  const { mailboxId } = route.useParams();
  const { composeKey } = route.useSearch();
  const navigate = route.useNavigate();

  useSetPageContext(useMemo(() => ({ route: "inbox" }), []));

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

  return (
    <div className="flex h-full min-h-0 w-full max-w-3xl min-w-0 flex-col">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span>New Email</span>
          </div>
        }
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate({
                to: "/$mailboxId/inbox",
                params: { mailboxId },
              })
            }
            aria-label="Close full composer"
          >
            <XIcon className="size-3.5" />
          </Button>
        }
      />

      <div className="flex  min-h-0 flex-1 flex-col">
        <ComposeEmailFields
          compose={compose}
          bodyClassName="flex-1 text-sm leading-relaxed"
          onEscape={() =>
            navigate({
              to: "/$mailboxId/inbox",
              params: { mailboxId },
            })
          }
          recipientAutoFocus={compose.to.trim().length === 0}
          editorAutoFocus={compose.to.trim().length > 0}
        />
      </div>
    </div>
  );
}
