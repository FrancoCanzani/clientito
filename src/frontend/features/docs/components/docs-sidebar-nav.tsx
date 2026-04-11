import { getAllDocs } from "@/features/docs/lib/docs";
import { Link } from "@tanstack/react-router";

const docs = getAllDocs();

export function DocsSidebarNav() {
  return (
    <nav aria-label="Documents">
      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
        Documents
      </p>
      <ul className="space-y-1 text-sm">
        <li>
          <Link
            to="/docs"
            activeOptions={{ exact: true }}
            activeProps={{ className: "font-semibold" }}
          >
            Overview
          </Link>
        </li>
        {docs.map((doc) => (
          <li key={doc.slug}>
            <Link
              to="/docs/$slug"
              params={{ slug: doc.slug }}
              activeProps={{ className: "font-semibold" }}
            >
              {doc.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
