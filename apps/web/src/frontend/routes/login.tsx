import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/features/auth/pages/login_page";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});
