import { SettingsSectionHeader } from "@/features/settings/components/settings-shell";
import { Button } from "@/components/ui/button";
import { useAuth, useLogout } from "@/hooks/use-auth";

export default function AccountPage() {
  const { user } = useAuth();
  const logoutMutation = useLogout();

  return (
    <section className="space-y-3">
      <SettingsSectionHeader
        group="General"
        title="Account"
        description="Basic profile details for your Duomo account."
      />
      <div className="border-t border-border/60">
        <Row label="Name" value={user?.name ?? "—"} />
        <div className="border-t border-border/60" />
        <Row label="Email" value={user?.email ?? "—"} truncate />
        <div className="border-t border-border/60" />
        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium">Session</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            {logoutMutation.isPending ? "Signing out..." : "Sign out"}
          </Button>
        </div>
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
