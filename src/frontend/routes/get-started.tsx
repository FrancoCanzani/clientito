import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/get-started")({
  beforeLoad: async () => {
    throw redirect({ to: "/inbox-redirect" });
  },
  component: () => null,
});
