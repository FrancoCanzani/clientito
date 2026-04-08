import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/agenda")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$mailboxId/inbox",
      params: { mailboxId: params.mailboxId },
    });
  },
});
