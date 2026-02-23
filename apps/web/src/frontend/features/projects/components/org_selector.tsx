import type { AuthOrgMembership } from "@/features/auth/auth_types";

interface OrgSelectorProps {
  orgs: AuthOrgMembership[];
  value: string;
  onChange: (orgId: string) => void;
}

export function OrgSelector({ orgs, value, onChange }: OrgSelectorProps) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-[#64748b]">
      <span className="font-medium">Org</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-[#d1dbe8] bg-white px-2 py-1 text-xs text-[#334155]"
      >
        {orgs.map((org) => (
          <option key={org.orgId} value={org.orgId}>
            {org.orgName}
          </option>
        ))}
      </select>
    </label>
  );
}
