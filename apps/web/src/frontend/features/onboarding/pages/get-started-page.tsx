import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createCustomersFromContacts,
  fetchContactsPaginated,
} from "@/features/contacts/api";
import {
  fetchSyncStatus,
  runIncrementalSync,
  startFullSync,
} from "@/features/dashboard/api";
import { createOrganization } from "@/features/workspace/api";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";

type Step = 0 | 1 | 2;

const dashboardRouteApi = getRouteApi("/_dashboard");

export default function GetStartedPage() {
  const { organizations } = dashboardRouteApi.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  const existingOrg = organizations[0] ?? null;
  const [step, setStep] = useState<Step>(existingOrg ? 1 : 0);
  const [orgId, setOrgId] = useState<string | null>(existingOrg?.id ?? null);
  const [orgName, setOrgName] = useState("");
  const [orgError, setOrgError] = useState<string | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState("");

  const createOrgMutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["workspace", "orgs"] });
      await router.invalidate();

      if (result.data?.id) {
        setOrgId(result.data.id);
        setOrgName("");
        setOrgError(null);
        setStep(1);
      }
    },
    onError: (error) => {
      setOrgError(
        error instanceof Error
          ? error.message
          : "Failed to create organization.",
      );
    },
  });

  const syncStatus = useQuery({
    queryKey: ["sync-status", orgId],
    queryFn: () => fetchSyncStatus(orgId!),
    enabled: Boolean(orgId),
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      if (phase && phase !== "error") return 2000;
      return false;
    },
  });

  const hasSynced = syncStatus.data?.hasSynced === true;
  const hasHistoryId = Boolean(syncStatus.data?.historyId);
  const isSyncRunning =
    syncStatus.data?.phase != null && syncStatus.data.phase !== "error";
  const progressCurrent = syncStatus.data?.progressCurrent ?? 0;
  const progressTotal = syncStatus.data?.progressTotal ?? 0;
  const progressPercent =
    progressTotal > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((progressCurrent / progressTotal) * 100)),
        )
      : 0;

  const fullSyncMutation = useMutation({
    mutationFn: () => startFullSync(orgId!, 12),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status", orgId] });
    },
  });

  const incrementalSyncMutation = useMutation({
    mutationFn: () => runIncrementalSync(orgId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-status", orgId] });
    },
  });

  const contactsQuery = useQuery({
    queryKey: ["contacts", orgId, "onboarding-simple"],
    queryFn: () =>
      fetchContactsPaginated(orgId!, undefined, { limit: 100, offset: 0 }),
    enabled: Boolean(orgId) && hasSynced && step === 2,
  });

  const contacts = useMemo(
    () => (contactsQuery.data?.data ?? []).filter((c) => !c.isAlreadyCustomer),
    [contactsQuery.data],
  );
  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => {
      return (
        contact.email.toLowerCase().includes(query) ||
        contact.domain.toLowerCase().includes(query) ||
        contact.name?.toLowerCase().includes(query)
      );
    });
  }, [contactSearch, contacts]);

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Missing organization");
      if (selectedEmails.size > 0) {
        await createCustomersFromContacts(orgId, Array.from(selectedEmails));
      }
    },
    onSuccess: async () => {
      if (!orgId) return;
      await queryClient.invalidateQueries({ queryKey: ["contacts", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["sync-status", orgId] });
      navigate({
        to: "/$orgId",
        params: { orgId },
        replace: true,
      });
    },
  });

  function handleCreateOrgAndNext() {
    if (orgId) {
      setStep(1);
      return;
    }

    const nextName = orgName.trim();
    if (!nextName) {
      setOrgError("Organization name is required.");
      return;
    }

    setOrgError(null);
    createOrgMutation.mutate({ name: nextName });
  }

  function handleSync() {
    if (!orgId) return;
    if (hasHistoryId) {
      incrementalSyncMutation.mutate();
    } else {
      fullSyncMutation.mutate();
    }
  }

  function toggleEmail(email: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  return (
    <div className="mx-auto h-screen flex items-center justify-evenly flex-col max-w-3xl">
      <section className="text-center">
        <h1 className="text-3xl font-medium tracking-tight">
          Welcome to Clientito
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We will be ready in a minute.
        </p>

        <div className="mt-8 italic text-xs text-muted-foreground">
          Step {step + 1} of 3
        </div>
      </section>

      {step === 0 && (
        <section className="space-y-1 w-1/2">
          <h2 className="font-medium">Set up your organization</h2>
          <div className="space-y-2 w-full">
            <Input
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
              placeholder="Acme Logistics"
              autoFocus
            />
            {orgError ? (
              <p className="text-xs text-destructive">{orgError}</p>
            ) : null}
          </div>
          <div className="flex mt-12 justify-end">
            <Button
              onClick={handleCreateOrgAndNext}
              disabled={createOrgMutation.isPending}
            >
              {createOrgMutation.isPending ? "Creating..." : "Next step"}
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-2 w-1/2">
          <h2 className="text-lg font-medium">Sync your Gmail</h2>
          <p className="text-sm text-muted-foreground">
            We will import your email history, build your contact agenda, and
            prepare your first customer suggestions.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            {!isSyncRunning ||
              (!hasSynced && (
                <Button
                  onClick={handleSync}
                  variant={"outline"}
                  disabled={
                    !orgId ||
                    isSyncRunning ||
                    fullSyncMutation.isPending ||
                    incrementalSyncMutation.isPending
                  }
                >
                  <ArrowsClockwiseIcon />
                  Start sync
                </Button>
              ))}
            {isSyncRunning && (
              <span className="text-xs text-muted-foreground">
                {progressTotal > 0
                  ? `${progressCurrent}/${progressTotal}`
                  : progressCurrent > 0
                    ? `${progressCurrent} processed`
                    : "Sync in progress..."}
              </span>
            )}
            {!isSyncRunning && hasSynced && (
              <span className="text-xs text-muted-foreground">
                Sync complete.
              </span>
            )}
          </div>
          {isSyncRunning && progressTotal > 0 && (
            <div className="mx-auto mt-1 h-1 w-48 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
          {syncStatus.data?.error ? (
            <p className="text-xs text-destructive">{syncStatus.data.error}</p>
          ) : null}
          <div className="flex justify-end mt-12">
            <Button onClick={() => setStep(2)} disabled={!hasSynced}>
              Next step
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <div>
            <h2 className="font-medium">Pick your first customers</h2>
            <p className="text-sm text-muted-foreground">
              Select contacts from your agenda and finish setup.
            </p>
          </div>
          <div className="flex justify-end max-w-md w-full">
            <Input
              value={contactSearch}
              onChange={(event) => setContactSearch(event.target.value)}
              placeholder="Search contacts..."
              className="max-w-md text-xs h-7"
            />
          </div>

          {contactsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredContacts.length > 0 ? (
            <div className="max-h-70 overflow-y-auto">
              {filteredContacts.map((contact) => {
                const selected = selectedEmails.has(contact.email);
                return (
                  <Label
                    key={contact.email}
                    className="flex cursor-pointer items-center justify-between gap-3 border-b border-dashed p-2 last:border-b-0 hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleEmail(contact.email)}
                        className="h-3.5 w-3.5"
                      />
                      <div className="min-w-0 flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {contact.name || contact.email}
                        </p>
                        {contact.name ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {contact.email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {contact.emailCount} emails
                    </span>
                  </Label>
                );
              })}
            </div>
          ) : contacts.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              No contacts match your search.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No contacts available yet. You can finish and add customers later.
            </p>
          )}

          <div className="flex mt-12 justify-end">
            <Button
              onClick={() => finishMutation.mutate()}
              disabled={finishMutation.isPending || !orgId}
            >
              {finishMutation.isPending ? "Finishing..." : "Finish"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
