import { LoaderCircle } from "lucide-react";

export function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
