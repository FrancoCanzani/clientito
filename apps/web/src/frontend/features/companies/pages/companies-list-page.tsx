import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useRouteContext } from "@/hooks/use-page-context";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { CompanyListItem } from "../types";

const companiesRouteApi = getRouteApi("/_dashboard/companies/");

function LogoAvatar({
  logoUrl,
  name,
  domain,
}: {
  logoUrl: string | null;
  name: string | null;
  domain: string;
}) {
  const [failed, setFailed] = useState(false);
  const letter = (name ?? domain)?.[0]?.toUpperCase() ?? "?";

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {letter}
    </div>
  );
}

const columns: ColumnDef<CompanyListItem>[] = [
  {
    accessorKey: "name",
    header: "Name",
    size: 220,
    cell: ({ row }) => {
      const company = row.original;
      return (
        <div className="flex items-center gap-3">
          <LogoAvatar
            logoUrl={company.logoUrl}
            name={company.name}
            domain={company.domain}
          />
          <span className="truncate font-medium">
            {company.name ?? "(Unnamed)"}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "domain",
    header: "Domain",
    size: 160,
    cell: ({ getValue }) => (
      <span className="inline-flex rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
        {getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "peopleCount",
    header: "People",
    size: 80,
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    size: 140,
    cell: ({ getValue }) =>
      formatDistanceToNowStrict(new Date(getValue<number>()), {
        addSuffix: true,
      }),
  },
];

export default function CompaniesListPage() {
  useRouteContext("/companies");
  const companiesResponse = companiesRouteApi.useLoaderData();
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data: companiesResponse.data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase();
      const name = (row.original.name ?? "").toLowerCase();
      const domain = row.original.domain.toLowerCase();
      return name.includes(search) || domain.includes(search);
    },
  });

  const totalCount = companiesResponse.data.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Companies</h1>
        <Input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search by name or domain"
          className="max-w-xs"
        />
      </div>

      <div className="text-sm text-muted-foreground">
        All Companies &middot; {totalCount}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            {table.getAllColumns().map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-border bg-muted/40"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer select-none px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() === "asc" && (
                        <span className="text-foreground">&uarr;</span>
                      )}
                      {header.column.getIsSorted() === "desc" && (
                        <span className="text-foreground">&darr;</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/30"
                  onClick={() =>
                    navigate({
                      to: "/companies/$companyId",
                      params: { companyId: String(row.original.id) },
                    })
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="truncate px-4 py-3"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No companies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
