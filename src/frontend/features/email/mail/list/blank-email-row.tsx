import { cn } from "@/lib/utils";

export function BlankEmailRow({
  listVariant = "mail",
  isMobile = false,
}: {
  listVariant?: "mail" | "task";
  isMobile?: boolean;
}) {
  if (listVariant === "task") {
    return (
      <div
        aria-hidden="true"
        className="mx-3 my-1 h-12 animate-pulse border border-border/30 bg-muted/40 md:mx-6"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-full w-full flex-col justify-center gap-2 border-b border-border/40 bg-background px-4 py-2",
        isMobile && "px-3",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="h-3 w-32 animate-pulse bg-muted" />
        <div className="ml-auto h-2.5 w-12 animate-pulse bg-muted/70" />
      </div>
      <div className="h-2.5 w-3/5 animate-pulse bg-muted/60" />
      <div className="h-2 w-4/5 animate-pulse bg-muted/40" />
    </div>
  );
}
