import { ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function Error({ error }: ErrorComponentProps) {
 const router = useRouter();
 const errorMessage =
 error instanceof Error ? error.message : "Something went wrong";

 return (
 <div className="flex h-screen flex-col items-center justify-center gap-y-7">
 <p className="font-semibold text-xl">Oops! Something went wrong</p>
 <p className="italic text-sm text-destructive">{errorMessage}</p>
 <Button onClick={() => router.invalidate()}>Retry</Button>
 </div>
 );
}
