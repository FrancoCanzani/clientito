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
      <div className="mx-auto max-w-[47rem]">
        <header className="mb-6 border-b border-[rgba(41,33,24,0.16)] pb-5">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[#5d554c]">
            Not Found
          </p>
          <h1 className="mt-2 text-[clamp(1.95rem,4.8vw,2.9rem)] leading-[1.04] tracking-[-0.025em] text-[#171411]">
            Document not found
          </h1>
          <p className="mt-4 max-w-[40rem] text-[1rem] leading-[1.65] text-[#5d554c]">
            The page you requested is not in this manual.
          </p>
        </header>

        <p className="leading-[1.7] text-[#5d554c]">
          <Link
            to="/docs"
            className="text-[#1f4f8a] underline underline-offset-[0.14em]"
          >
            Return to the docs index
          </Link>
        </p>
      </div>
    );
  }

  const neighbors = getDocNeighbors(doc.slug);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,47rem)_minmax(12rem,15rem)] xl:gap-10">
      <article className="mx-auto max-w-[47rem]">
        <header className="mb-6 border-b border-[rgba(41,33,24,0.16)] pb-5">
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[#5d554c]">
            Document
          </p>
          <h1 className="mt-2 text-[clamp(1.95rem,4.8vw,2.9rem)] leading-[1.04] tracking-[-0.025em] text-[#171411]">
            {doc.title}
          </h1>
          {doc.description ? (
            <p className="mt-4 max-w-[40rem] text-[1rem] leading-[1.65] text-[#5d554c]">
              {doc.description}
            </p>
          ) : null}
        </header>

        <div
          className={[
            "prose prose-stone max-w-none text-[0.97rem] leading-[1.68] text-[#171411]",
            "prose-headings:font-normal prose-headings:leading-[1.15] prose-headings:scroll-mt-8",
            "prose-h1:mb-4 prose-h1:mt-0 prose-h1:text-[1.8rem]",
            "prose-h2:mt-10 prose-h2:mb-3 prose-h2:border-t prose-h2:border-[rgba(41,33,24,0.16)] prose-h2:pt-1 prose-h2:text-[1.4rem]",
            "prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-[1.12rem]",
            "prose-p:my-3 prose-p:text-[#171411]",
            "prose-a:text-[#1f4f8a] prose-a:underline prose-a:underline-offset-[0.14em]",
            "prose-ul:my-3 prose-ol:my-3 prose-li:my-1",
            "prose-code:rounded-none prose-code:bg-[rgba(41,33,24,0.07)] prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.92em] prose-code:font-normal prose-code:text-[#171411] prose-code:before:content-none prose-code:after:content-none",
            "prose-pre:my-4 prose-pre:overflow-x-auto prose-pre:rounded-none prose-pre:border prose-pre:border-[rgba(41,33,24,0.16)] prose-pre:bg-[rgba(255,255,255,0.42)] prose-pre:px-4 prose-pre:py-4",
            "prose-pre:font-normal prose-pre:text-[#171411]",
            "prose-blockquote:border-l-2 prose-blockquote:border-[rgba(41,33,24,0.16)] prose-blockquote:pl-4 prose-blockquote:text-[#5d554c]",
            "prose-hr:my-8 prose-hr:border-[rgba(41,33,24,0.16)]",
            "prose-table:my-4 prose-table:w-full prose-table:border-collapse",
            "prose-th:border prose-th:border-[rgba(41,33,24,0.16)] prose-th:bg-[rgba(41,33,24,0.04)] prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold",
            "prose-td:border prose-td:border-[rgba(41,33,24,0.16)] prose-td:px-3 prose-td:py-2 prose-td:align-top",
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
          className="mt-10 flex justify-between gap-4 border-t border-[rgba(41,33,24,0.16)] pt-4 leading-[1.7] text-[#5d554c]"
          aria-label="Document pagination"
        >
          <div>
            {neighbors.previous ? (
              <Link
                to="/docs/$slug"
                params={{ slug: neighbors.previous.slug }}
                className="text-[#1f4f8a] underline underline-offset-[0.14em]"
              >
                Previous: {neighbors.previous.title}
              </Link>
            ) : null}
          </div>
          <div>
            {neighbors.next ? (
              <Link
                to="/docs/$slug"
                params={{ slug: neighbors.next.slug }}
                className="text-[#1f4f8a] underline underline-offset-[0.14em]"
              >
                Next: {neighbors.next.title}
              </Link>
            ) : null}
          </div>
        </nav>
      </article>

      {doc.headings.length > 0 ? (
        <aside
          className="mt-7 border-t border-[rgba(41,33,24,0.16)] pt-4 xl:sticky xl:top-6 xl:mt-0 xl:max-h-[calc(100vh-3rem)] xl:overflow-auto xl:border-t-0 xl:pt-1"
          aria-label="Table of contents"
        >
          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[#5d554c]">
            On this page
          </p>
          <ul className="mt-3 border-l border-[rgba(41,33,24,0.16)] pl-4">
            {doc.headings.map((heading, index) => (
              <li
                key={heading.id}
                className={[
                  "text-[0.9rem] leading-[1.45] text-[#5d554c]",
                  index > 0 ? "mt-[0.55rem]" : "",
                  heading.level === 3 ? "pl-3 text-[0.86rem]" : "",
                ].join(" ")}
              >
                <a
                  href={`#${heading.id}`}
                  className="text-[#1f4f8a] underline underline-offset-[0.14em]"
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
