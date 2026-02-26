import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchContacts } from "@/features/contacts/api";
import { addCustomerContact, createCustomer } from "@/features/customers/api";

const organizationRouteApi = getRouteApi("/_dashboard/$orgId");

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export default function NewCustomerPage() {
  const { orgId } = organizationRouteApi.useLoaderData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [vatEin, setVatEin] = useState("");
  const [address, setAddress] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactEmails, setSelectedContactEmails] = useState<Set<string>>(
    new Set(),
  );

  const contactsQuery = useQuery({
    queryKey: ["contacts", orgId, contactSearch],
    queryFn: () => fetchContacts(orgId, contactSearch || undefined),
  });

  const availableContacts = useMemo(
    () =>
      (contactsQuery.data ?? [])
        .filter((contact) => !contact.isAlreadyCustomer)
        .sort((a, b) => {
          if (a.emailCount !== b.emailCount) return b.emailCount - a.emailCount;
          return a.email.localeCompare(b.email);
        }),
    [contactsQuery.data],
  );

  function toggleContact(emailAddress: string) {
    setSelectedContactEmails((prev) => {
      const next = new Set(prev);
      if (next.has(emailAddress)) {
        next.delete(emailAddress);
      } else {
        next.add(emailAddress);
      }
      return next;
    });
  }

  function clearSelectedContacts() {
    setSelectedContactEmails(new Set());
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const customer = await createCustomer({
        orgId,
        name,
        email,
        company: company || undefined,
        phone: phone || undefined,
        website: website || undefined,
        vatEin: vatEin || undefined,
        address: address || undefined,
      });

      const primaryEmail = normalizeEmail(customer.email);
      const contactsToLink = Array.from(selectedContactEmails).filter(
        (contactEmail) => normalizeEmail(contactEmail) !== primaryEmail,
      );

      if (contactsToLink.length > 0) {
        await Promise.allSettled(
          contactsToLink.map((contactEmail) =>
            addCustomerContact(customer.id, contactEmail),
          ),
        );
      }

      return customer;
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
      queryClient.invalidateQueries({ queryKey: ["contacts", orgId] });
      navigate({
        to: "/$orgId/customers/$customerId",
        params: { orgId, customerId: customer.id },
      });
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">New customer</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ to: "/$orgId/customers", params: { orgId } })}
        >
          Back
        </Button>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Customer info</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Acme Inc."
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 555 123 4567"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="vatEin">VAT / EIN</Label>
              <Input
                id="vatEin"
                value={vatEin}
                onChange={(event) => setVatEin(event.target.value)}
                placeholder="Tax ID"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="123 Main St"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Contacts</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {selectedContactEmails.size} selected
              </Badge>
              {selectedContactEmails.size > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearSelectedContacts}
                >
                  clear
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search contacts..."
              value={contactSearch}
              onChange={(event) => setContactSearch(event.target.value)}
            />

            {contactsQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : availableContacts.length > 0 ? (
              <div className="max-h-64 divide-y overflow-y-auto rounded border">
                {availableContacts.map((contact) => {
                  const checked = selectedContactEmails.has(contact.email);
                  return (
                    <label
                      key={contact.email}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleContact(contact.email)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {contact.name || contact.email}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {contact.email}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {contact.emailCount}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No contacts available for selection.
              </p>
            )}
          </CardContent>
        </Card>

        {mutation.error instanceof Error && (
          <p className="text-xs text-destructive">{mutation.error.message}</p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!name.trim() || !email.trim() || mutation.isPending}
          >
            {mutation.isPending ? "Creating..." : "Create customer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
