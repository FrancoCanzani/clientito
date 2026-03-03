import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { deleteAccount } from "@/features/settings/api";
import { useTheme } from "@/hooks/use-theme";
import { MoonIcon, SunIcon, MonitorIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [confirmText, setConfirmText] = useState("");

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      toast.success("Account deleted");
      navigate({ to: "/login" });
    },
    onError: (error) => toast.error(error.message),
  });

  const themeOptions = [
    { value: "light" as const, label: "Light", icon: SunIcon },
    { value: "dark" as const, label: "Dark", icon: MoonIcon },
    { value: "system" as const, label: "System", icon: MonitorIcon },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-xl font-medium tracking-tight">Settings</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Account
        </h2>
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">
              Name
            </span>
            <span>{user?.name ?? "—"}</span>
          </div>
          <div className="flex items-baseline gap-2 text-sm">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">
              Email
            </span>
            <span>{user?.email ?? "—"}</span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Appearance
        </h2>
        <div className="flex gap-2">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                theme === option.value
                  ? "border-foreground bg-foreground/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              <option.icon className="size-4" />
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-destructive">
          Danger zone
        </h2>
        <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
          <div className="flex items-center gap-3">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className="max-w-xs text-sm"
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={
                confirmText !== "DELETE" || deleteMutation.isPending
              }
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete account"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
