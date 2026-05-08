// Read-only account card. We don't let couples change their own login email
// from here (that's a Supabase auth flow). What we DO surface: the email of
// record + when they joined, plus a quick link back to the onboarding chat
// in case they want to redo intake from scratch.

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function AccountCard({
  email,
  memberSince,
}: {
  email: string;
  memberSince: string | null;
}) {
  const memberSinceLabel = memberSince
    ? new Date(memberSince).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6">
      <div className="mb-4">
        <h2 className="font-serif text-2xl">Account</h2>
        <p className="mt-1 text-sm text-stone-600">
          The email you log in with and when this workspace was created.
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
            Email
          </dt>
          <dd className="mt-1 truncate text-sm text-stone-900">{email}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
            Member since
          </dt>
          <dd className="mt-1 text-sm text-stone-900">{memberSinceLabel}</dd>
        </div>
      </dl>
      <div className="mt-5 border-t border-stone-100 pt-4">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-900 hover:underline"
        >
          Re-run onboarding chat
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <p className="mt-1 text-xs text-stone-500">
          Starts a fresh AI intake. Your existing data isn&apos;t lost — the
          chat will just walk you through any blanks again.
        </p>
      </div>
    </div>
  );
}
