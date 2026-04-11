import { getDocBySlug, getDocNeighbors, getHeadingId } from "@/features/docs/lib/docs";
import { getRouteApi, Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isValidElement, type ReactNode } from "react";

const docsSlugRoute = getRouteApi("/docs/$slug");

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }

  return "";
}

export default function DocPage() {
  const { slug } = docsSlugRoute.useParams();
  const doc = getDocBySlug(slug);

  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-semibold">Document not found</h1>
        <p className="text-sm text-muted-foreground">This page does not exist.</p>
        <p className="mt-3 text-sm">
          <Link to="/docs">Return to docs index</Link>
        </p>
      </div>
    );
  }

  const neighbors = getDocNeighbors(doc.slug);

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_220px]">
      <article className="min-w-0">
        <h1 className="mb-2 text-2xl font-semibold">{doc.title}</h1>
        {doc.description && (
          <p className="mb-5 text-sm text-muted-foreground">{doc.description}</p>
        )}

        <div
          className={[
            "prose prose-neutral dark:prose-invert max-w-none text-sm",
            "prose-headings:scroll-mt-20",
            "prose-a:underline",
            "prose-pre:overflow-x-auto",
          ].join(" ")}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 id={getHeadingId(extractText(children))}>{children}</h1>,
              h2: ({ children }) => <h2 id={getHeadingId(extractText(children))}>{children}</h2>,
              h3: ({ children }) => <h3 id={getHeadingId(extractText(children))}>{children}</h3>,
            }}
          >
            {doc.content}
          </ReactMarkdown>
        </div>

        <nav
          className="mt-8 flex flex-wrap justify-between gap-3 border-t pt-4 text-sm"
          aria-label="Document pagination"
        >
          <div>
            {neighbors.previous && (
              <Link to="/docs/$slug" params={{ slug: neighbors.previous.slug }}>
                ← {neighbors.previous.title}
              </Link>
            )}
          </div>
          <div>
            {neighbors.next && (
              <Link to="/docs/$slug" params={{ slug: neighbors.next.slug }}>
                {neighbors.next.title} →
              </Link>
            )}
          </div>
        </nav>
      </article>

      {doc.headings.length > 0 && (
        <aside
          className="hidden text-sm xl:sticky xl:top-6 xl:block"
          aria-label="Table of contents"
        >
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            On this page
          </p>
          <ul className="space-y-1">
            {doc.headings.map((heading) => (
              <li
                key={heading.id}
                className={[
                  "text-muted-foreground",
                  heading.level === 3 ? "pl-3" : "",
                ].join(" ")}
              >
                <a href={`#${heading.id}`}>{heading.text}</a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
