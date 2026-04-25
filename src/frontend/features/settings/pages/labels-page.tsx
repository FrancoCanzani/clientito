import { LabelsSettingsSection } from "@/features/settings/components/labels-settings-section";
import { useParams } from "@tanstack/react-router";

export default function LabelsPage() {
  const { mailboxId } = useParams({ from: "/_dashboard/$mailboxId/settings" });

  return <LabelsSettingsSection mailboxId={mailboxId} />;
}
