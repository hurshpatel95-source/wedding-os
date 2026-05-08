import Link from "next/link";
import { Heart } from "lucide-react";
import { CouplesSignupForm } from "@/components/couples-signup/couples-signup-form";

export const metadata = {
  title: "Plan your wedding · wedding-os",
  description:
    "Spin up your own wedding planning workspace in 60 seconds. AI co-pilot, 12-month plan, and a public RSVP site — built for couples doing it themselves.",
};

export default function CouplesSignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-white to-rose-50/30 text-stone-900">
      <header className="border-b border-stone-200/40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
          <Link href="/marketing" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-amber-600 shadow-sm">
              <Heart className="h-4 w-4 text-white" fill="white" />
            </div>
            <span className="font-serif text-lg font-medium tracking-tight">
              wedding-os
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-stone-700 hover:text-stone-900"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-12 px-6 py-16 md:grid-cols-[1fr_1fr] md:py-24">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
            For couples
          </div>
          <h1 className="mt-2 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Plan your wedding,
            <br />
            <span className="bg-gradient-to-r from-rose-600 to-amber-700 bg-clip-text text-transparent">
              without losing your mind.
            </span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-stone-700">
            wedding-os was built for planners, but we kept hearing from couples
            who wanted to do it themselves — with the same playbook, the same
            AI co-pilot, the same vendor tooling. So here&rsquo;s the front
            door, just for you.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-stone-700">
            <Bullet>
              An AI co-pilot that knows your wedding inside and out — your
              date, your guest count, your venue, your vendors. Ask it anything.
            </Bullet>
            <Bullet>
              A 12-month plan with no blank pages. We pre-fill your timeline
              with the exact tasks the best planners use, sequenced for your
              wedding date.
            </Bullet>
            <Bullet>
              A public RSVP site you&rsquo;ll actually be proud to share —
              schedule, registry, hotel block, dietary collection, all in one
              place.
            </Bullet>
          </ul>
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white/70 p-4 text-sm text-stone-700">
            <span className="font-medium text-stone-900">Free during beta.</span>{" "}
            Paid plan ($19/mo) coming when we leave beta. Lock in early.
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
          <CouplesSignupForm />
        </div>
      </main>

      <footer className="border-t border-stone-200/60 py-10 text-center">
        <div className="text-xs text-stone-500">
          Are you a planner running a studio?{" "}
          <Link
            href="/signup"
            className="font-medium text-stone-700 underline-offset-2 hover:underline"
          >
            Start your studio →
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
      <span>{children}</span>
    </li>
  );
}
