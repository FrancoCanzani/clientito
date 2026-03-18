import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/people/$personId")({
  beforeLoad: () => {
    throw redirect({ to: "/inbox" });
  },
});
