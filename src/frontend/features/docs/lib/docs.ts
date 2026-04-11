type Heading = {
  id: string;
  level: 2 | 3;
  text: string;
};

export type Doc = {
  slug: string;
  title: string;
  description: string;
  content: string;
  headings: Heading[];
};

const docsModules: Record<string, string> = import.meta.glob("/docs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const DOC_ORDER = [
  "getting-started",
  "connect-your-mailbox",
  "inbox-and-search",
  "sync-troubleshooting",
  "security-and-privacy",
  "email-sync",
] as const;

function getOrderIndex(slug: string) {
  const index = DOC_ORDER.indexOf(slug as (typeof DOC_ORDER)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function titleizeSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function parseTitle(content: string, fallbackSlug: string) {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || titleizeSlug(fallbackSlug);
}

function parseDescription(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (
      !line.startsWith("#") &&
      !line.startsWith("- ") &&
      !line.startsWith("* ") &&
      !/^\d+\.\s/.test(line) &&
      !line.startsWith("```")
    ) {
      return line;
    }
  }

  return "";
}

function stripLeadingTitle(content: string) {
  return content.replace(/^#\s+.+\n+/, "");
}

function parseHeadings(content: string) {
  const matches = [...content.matchAll(/^(##|###)\s+(.+)$/gm)];

  return matches.map(([_, hashes, rawText]) => {
    const text = rawText.trim();
    const level: Heading["level"] = hashes === "##" ? 2 : 3;

    return {
      id: slugify(text),
      level,
      text,
    };
  });
}

const docs = Object.entries(docsModules)
  .map(([path, content]) => {
    const slug = path.split("/").pop()?.replace(/\.md$/, "") ?? "untitled";

    return {
      slug,
      title: parseTitle(content, slug),
      description: parseDescription(content),
      content: stripLeadingTitle(content),
      headings: parseHeadings(content),
    } satisfies Doc;
  })
  .sort((a, b) => {
    const orderDiff = getOrderIndex(a.slug) - getOrderIndex(b.slug);
    if (orderDiff !== 0) return orderDiff;
    return a.title.localeCompare(b.title);
  });

export function getAllDocs() {
  return docs;
}

export function getDocBySlug(slug: string) {
  return docs.find((doc) => doc.slug === slug);
}

export function getDocNeighbors(slug: string) {
  const index = docs.findIndex((doc) => doc.slug === slug);

  if (index === -1) {
    return {
      previous: undefined,
      next: undefined,
    };
  }

  return {
    previous: docs[index - 1],
    next: docs[index + 1],
  };
}

export function getHeadingId(text: string) {
  return slugify(text);
}
