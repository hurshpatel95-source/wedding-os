// Root 404 — replaces the unbranded Next.js default with our typography.
// Triggered by notFound() and route mismatches. /w/<slug> notFound()
// (unpublished public sites) lands here too.

import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] text-stone-500">
          404
        </div>
        <h1 className="mt-3 font-serif text-4xl font-light tracking-tight">
          We couldn&rsquo;t find that.
        </h1>
        <p className="mt-3 text-sm text-stone-600">
          The page might have moved, or the link expired.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            Back to dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-900"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
