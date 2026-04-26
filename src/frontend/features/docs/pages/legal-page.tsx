import { getDocBySlug, getHeadingId } from "@/features/docs/lib/docs";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isValidElement, type ReactNode } from "react";

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

export function LegalPage({ slug }: { slug: "privacy" | "terms" }) {
  const doc = getDocBySlug(slug);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            Duomo
          </Link>
          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/docs" className="hover:text-foreground">
              Docs
            </Link>
            <Link to="/login" className="hover:text-foreground">
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-12 md:py-16">
        {doc ? (
          <article className="min-w-0">
            <h1 className="mb-3 font-serif text-4xl font-medium tracking-tight">
              {doc.title}
            </h1>
            {doc.description && (
              <p className="mb-8 text-sm text-muted-foreground">
                {doc.description}
              </p>
            )}

            <div
              className={[
                "prose prose-neutral dark:prose-invert max-w-none text-sm",
                "prose-headings:scroll-mt-20 prose-headings:font-serif prose-headings:font-medium",
                "prose-h2:mt-10 prose-h2:text-xl",
                "prose-h3:mt-6 prose-h3:text-base",
                "prose-a:underline prose-a:underline-offset-4",
                "prose-p:leading-relaxed",
              ].join(" ")}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => (
                    <h2 id={getHeadingId(extractText(children))}>{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 id={getHeadingId(extractText(children))}>{children}</h3>
                  ),
                }}
              >
                {doc.content}
              </ReactMarkdown>
            </div>
          </article>
        ) : (
          <div>
            <h1 className="mb-2 text-2xl font-semibold">Page not found</h1>
            <p className="text-sm text-muted-foreground">
              This page does not exist.
            </p>
            <p className="mt-3 text-sm">
              <Link to="/">Return home</Link>
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Duomo</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/docs" className="hover:text-foreground">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
