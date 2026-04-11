import { getAllDocs } from "@/features/docs/lib/docs";
import { Link } from "@tanstack/react-router";

const docs = getAllDocs();
const coreFlow = [
  "getting-started",
  "connect-your-mailbox",
  "inbox-and-search",
  "sync-troubleshooting",
  "security-and-privacy",
];
const coreDocs = coreFlow
  .map((slug) => docs.find((doc) => doc.slug === slug))
  .filter((doc) => doc != null);

export default function DocsHomePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Petit docs</h1>
        <p className="text-sm text-muted-foreground">
          Open command palette and run <code>&gt; docs</code> anytime.
        </p>
      </header>

      {coreDocs.length > 0 && (
        <section className="space-y-2" aria-label="Core flow">
          <h2 className="text-base font-semibold">
            Start here
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            {coreDocs.map((doc) => (
              <li key={doc.slug}>
                <Link to="/docs/$slug" params={{ slug: doc.slug }}>
                  {doc.title}
                </Link>
                {doc.description && (
                  <p className="text-sm text-muted-foreground">
                    {doc.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2 pt-2" aria-label="All documents">
        <h2 className="text-base font-semibold">
          All documents
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          {docs.map((doc) => (
            <li key={doc.slug}>
              <Link to="/docs/$slug" params={{ slug: doc.slug }}>
                {doc.title}
              </Link>
              {doc.description && (
                <p className="text-sm text-muted-foreground">
                  {doc.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
