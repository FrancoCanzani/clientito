import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/people/")({
  beforeLoad: () => {
    throw redirect({ to: "/inbox" });
  },
});
