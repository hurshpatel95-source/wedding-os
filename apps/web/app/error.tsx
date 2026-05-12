"use client";

// Root error boundary. Catches any uncaught error from server or client
// components below. Without this, Next.js showed a raw stack-trace
// overlay in dev and an unbranded fallback in prod.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[wedding-os root error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-serif text-2xl">Something went sideways.</h1>
          <p className="mt-2 text-sm text-stone-600">
            Refresh, or try one of the links below. If this keeps happening,
            tell us — error ref:
          </p>
          {error.digest && (
            <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-stone-400">
              ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-900"
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
