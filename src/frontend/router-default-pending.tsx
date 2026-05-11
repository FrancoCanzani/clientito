export function DefaultPending() {
  return (
    <div className="flex flex-1 min-h-[50vh] w-full flex-col items-center justify-center p-8">
      <p className="animate-pulse text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
