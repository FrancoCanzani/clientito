import { ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function Error({ error }: ErrorComponentProps) {
  const router = useRouter();
  const errorMessage =
    error instanceof Error ? error.message : "Something went wrong";

  return (
    <div className="h-screen flex flex-col space-y-7 items-center justify-center">
      <p className="font-semibold text-xl">Oops! Something went wrong</p>
      <p className="italic text-sm text-destructive">{errorMessage}</p>
      <Button onClick={() => router.invalidate()}>Retry</Button>
    </div>
  );
}
