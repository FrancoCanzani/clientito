import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/inbox/search")({
  beforeLoad: () => {
    throw redirect({
      href: "/inbox/all/search",
      replace: true,
    });
  },
});
