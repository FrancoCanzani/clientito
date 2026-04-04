import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$mailboxId/home",
      params: { mailboxId: params.mailboxId },
    });
  },
});
