import { createFileRoute } from "@tanstack/react-router";
import ContactsPickerPage from "@/features/contacts/pages/contacts-picker-page";

export const Route = createFileRoute("/_dashboard/$orgId/contacts/")({
  component: ContactsPickerPage,
});
