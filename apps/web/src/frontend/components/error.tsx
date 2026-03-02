import { ErrorComponentProps, useRouter } from "@tanstack/react-router";

export function Error({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div>
      <p>{(error as Error)?.message ?? "Something went wrong"}</p>
      <button onClick={() => router.invalidate()}>Retry</button>
    </div>
  );
}
