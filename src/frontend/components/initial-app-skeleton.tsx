import { BlankEmailRow } from "@/features/email/mail/list/blank-email-row";

const SKELETON_ROWS = Array.from({ length: 15 });

export function InitialAppSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background"
    >
      <div className="flex min-h-12 shrink-0 items-center border-b border-border/40 px-4">
        <div className="h-3 w-24 animate-pulse bg-muted" />
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-56 shrink-0 border-r border-border/40 bg-sidebar p-3 md:block">
          <div className="mb-5 h-3 w-20 animate-pulse bg-muted" />
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="h-7 w-full animate-pulse bg-muted/70"
              />
            ))}
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-hidden">
          {SKELETON_ROWS.map((_, index) => (
            <div key={index} className="h-21">
              <BlankEmailRow />
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
