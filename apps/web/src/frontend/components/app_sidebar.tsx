import { Link, useMatchRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  BookText,
  CheckSquare,
  Code2,
  FolderKanban,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/api/auth_api";
import { OrgSelector } from "@/features/projects/components/org_selector";
import {
  getStoredOrgId,
  ORG_CHANGED_EVENT,
  setStoredOrgId,
} from "@/features/projects/project_schemas";

const LAST_PROJECT_STORAGE_KEY = "rl_last_project_id";

export function AppSidebar() {
  const { user } = useAuth();
  const matchRoute = useMatchRoute();
  const [selectedOrgId, setSelectedOrgId] = useState(() => getStoredOrgId());
  const rememberedProjectId = useMemo(() => {
    try {
      return localStorage.getItem(LAST_PROJECT_STORAGE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    const handleOrgChange = () => {
      setSelectedOrgId(getStoredOrgId());
    };

    window.addEventListener(ORG_CHANGED_EVENT, handleOrgChange);
    return () => window.removeEventListener(ORG_CHANGED_EVENT, handleOrgChange);
  }, []);

  const projectMatch = matchRoute({
    to: "/projects/$project_id",
    fuzzy: true,
  });
  const routeProjectId = projectMatch ? projectMatch.project_id : undefined;

  useEffect(() => {
    if (!routeProjectId) return;
    try {
      localStorage.setItem(LAST_PROJECT_STORAGE_KEY, routeProjectId);
    } catch {
      // best effort persistence only
    }
  }, [routeProjectId]);

  const effectiveProjectId = routeProjectId ?? rememberedProjectId;
  const selectedOrg =
    user?.orgs.find((org) => org.orgId === selectedOrgId) ?? user?.orgs[0] ?? null;
  const effectiveOrgId = selectedOrg?.orgId ?? "";

  return (
    <aside className="hidden w-60 shrink-0 border-r border-[#e2e8f0] bg-[#fcfdff] text-sidebar-foreground md:block">
      <div className="border-b border-[#e2e8f0] px-4 py-3">
        <div className="text-sm font-semibold tracking-tight text-[#0f172a]">ReleaseLayer</div>
        {user?.email && (
          <div className="mt-0.5 truncate text-[11px] text-[#64748b]">
            {user.email}
          </div>
        )}
        {user && user.orgs.length > 0 && (
          <div className="mt-2">
            <OrgSelector
              orgs={user.orgs}
              value={effectiveOrgId}
              onChange={(nextOrgId) => {
                setSelectedOrgId(nextOrgId);
                setStoredOrgId(nextOrgId);
              }}
            />
          </div>
        )}
      </div>

      <nav className="space-y-1 p-2.5">
        <SidebarLink to="/projects" label="Projects" icon={FolderKanban} />
        <SidebarProjectLink
          to="/projects/$project_id"
          params={effectiveProjectId ? { project_id: effectiveProjectId } : undefined}
          label="Releases"
          icon={BookText}
        />
        <SidebarProjectLink
          to="/projects/$project_id/checklists"
          params={effectiveProjectId ? { project_id: effectiveProjectId } : undefined}
          label="Checklists"
          icon={CheckSquare}
        />
        <SidebarProjectLink
          to="/projects/$project_id/integrations"
          params={effectiveProjectId ? { project_id: effectiveProjectId } : undefined}
          label="Integrations"
          icon={Plug}
        />
        <SidebarProjectLink
          to="/projects/$project_id/sdk"
          params={effectiveProjectId ? { project_id: effectiveProjectId } : undefined}
          label="SDK"
          icon={Code2}
        />
      </nav>
    </aside>
  );
}

function SidebarLink(props: {
  to: "/projects";
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  const Icon = props.icon;

  return (
    <Link
      to={props.to}
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-[#334155] hover:bg-[#eef4ff] hover:text-[#0f172a]"
      activeProps={{
        className: "bg-[#dbeafe] text-[#0f172a] hover:bg-[#dbeafe] hover:text-[#0f172a]",
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{props.label}</span>
    </Link>
  );
}

function SidebarProjectLink(props: {
  to:
    | "/projects/$project_id"
    | "/projects/$project_id/checklists"
    | "/projects/$project_id/integrations"
    | "/projects/$project_id/sdk";
  params: { project_id: string } | undefined;
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  const Icon = props.icon;
  const sharedClass =
    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-[#334155] hover:bg-[#eef4ff] hover:text-[#0f172a]";

  if (!props.params) {
    return (
      <span
        className={cn(
          sharedClass,
          "cursor-not-allowed text-[#94a3b8] hover:bg-transparent hover:text-[#94a3b8]"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{props.label}</span>
      </span>
    );
  }

  return (
    <Link
      to={props.to}
      params={props.params}
      className={sharedClass}
      activeProps={{
        className: "bg-[#dbeafe] text-[#0f172a] hover:bg-[#dbeafe] hover:text-[#0f172a]",
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{props.label}</span>
    </Link>
  );
}
