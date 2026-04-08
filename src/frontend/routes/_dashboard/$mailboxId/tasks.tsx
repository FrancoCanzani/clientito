import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/tasks")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$mailboxId/inbox",
      params: { mailboxId: params.mailboxId },
    });
  },
});
