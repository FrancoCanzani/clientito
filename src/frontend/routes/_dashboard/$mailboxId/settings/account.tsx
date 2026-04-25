import AccountPage from "@/features/settings/pages/account-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/settings/account")({
  component: AccountPage,
});
