import { ArrowLeft, House } from "@phosphor-icons/react";
import { Link, useRouter } from "@tanstack/react-router";

export default function NotFound() {
 const router = useRouter();

 return (
 <div className="flex min-h-screen items-center justify-center bg-background px-6 py-24 sm:py-32 lg:px-8">
 <div className="mx-auto max-w-xl text-center">
 <p className="text-base font-semibold text-primary">
 404
 </p>
 <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
 Page not found
 </h1>
 <p className="mt-6 text-base leading-7">
 Sorry, we couldn’t find the page you’re looking for.
 </p>

 <div className="mt-10 flex items-center justify-center gap-4">
 <button
 onClick={() => router.history.back()}
 className="inline-flex items-center gap-2 border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 >
 <ArrowLeft size={16} weight="bold" />
 Go back
 </button>
 <Link
 to="/"
 className="inline-flex items-center gap-2 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 >
 <House size={16} weight="fill" />
 Home
 </Link>
 </div>
 </div>
 </div>
 );
}
