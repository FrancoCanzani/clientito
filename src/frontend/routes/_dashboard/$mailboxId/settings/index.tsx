import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/settings/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$mailboxId/settings/account",
      params: { mailboxId: params.mailboxId },
    });
  },
});
