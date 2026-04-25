import { SettingsSectionHeader } from "@/features/settings/components/settings-shell";
import { useAuth } from "@/hooks/use-auth";

export default function AccountPage() {
  const { user } = useAuth();

  return (
    <section className="space-y-3">
      <SettingsSectionHeader
        group="General"
        title="Account"
        description="Basic profile details for your Petit account."
      />
      <div className="border-t border-border/60">
        <Row label="Name" value={user?.name ?? "—"} />
        <div className="border-t border-border/60" />
        <Row label="Email" value={user?.email ?? "—"} truncate />
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-medium">{label}</p>
      <p
        className={`text-xs text-foreground sm:text-right ${truncate ? "truncate" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
