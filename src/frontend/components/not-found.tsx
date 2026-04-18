import { ArrowLeft, House } from "@phosphor-icons/react";
import { Link, useRouter } from "@tanstack/react-router";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-24 dark:bg-gray-950 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-base font-semibold text-indigo-600 dark:text-indigo-400">
          404
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
          Page not found
        </h1>
        <p className="mt-6 text-base leading-7">
          Sorry, we couldn’t find the page you’re looking for.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <button
            onClick={() => router.history.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 dark:focus:ring-offset-gray-950"
          >
            <ArrowLeft size={16} weight="bold" />
            Go back
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950"
          >
            <House size={16} weight="fill" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
