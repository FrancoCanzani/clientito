import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "@/features/auth/pages/register_page";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});
