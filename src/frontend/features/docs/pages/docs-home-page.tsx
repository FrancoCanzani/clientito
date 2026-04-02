import { getAllDocs } from "@/features/docs/lib/docs";
import { Link } from "@tanstack/react-router";

const docs = getAllDocs();

export default function DocsHomePage() {
  return (
    <div className="mx-auto max-w-[47rem]">
      <header className="mb-6 border-b border-[rgba(41,33,24,0.16)] pb-5">
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[#5d554c]">
          Petit Documentation
        </p>
        <h1 className="mt-2 text-[clamp(1.95rem,4.8vw,2.9rem)] leading-[1.04] tracking-[-0.025em] text-[#171411]">
          Reference Manual
        </h1>
        <p className="mt-4 max-w-[40rem] text-[1rem] leading-[1.65] text-[#5d554c]">
          A quiet place for architecture notes, implementation details, and
          operating knowledge.
        </p>
      </header>

      <section
        className="border-t border-[rgba(41,33,24,0.16)]"
        aria-label="Available documents"
      >
        {docs.map((doc) => (
          <article
            key={doc.slug}
            className="border-b border-[rgba(41,33,24,0.16)] py-[1.1rem]"
          >
            <h2 className="text-[1.2rem] font-normal text-[#171411]">
              <Link
                to="/docs/$slug"
                params={{ slug: doc.slug }}
                className="text-[#1f4f8a] underline underline-offset-[0.14em]"
              >
                {doc.title}
              </Link>
            </h2>
            {doc.description && (
              <p className="mt-2 leading-[1.7] text-[#5d554c]">
                {doc.description}
              </p>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
