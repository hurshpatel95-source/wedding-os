import Link from "next/link";
import { Heart } from "lucide-react";
import { SignupForm } from "@/components/signup/signup-form";

export const metadata = {
  title: "Start your studio · wedding-os",
  description:
    "Spin up your wedding-os studio in under a minute. No card needed.",
};

export default function SignupPage() {
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
            Get started
          </div>
          <h1 className="mt-2 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Spin up your studio
          </h1>
          <p className="mt-4 text-base leading-relaxed text-stone-700">
            We&rsquo;ll create your wedding-os organization, send you a
            magic-link to sign in, and drop you into the admin shell. From
            there you&rsquo;ll seed your library, write your playbook, and
            invite your first couple.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-stone-700">
            <Bullet>One-click magic-link sign-in. No password to forget.</Bullet>
            <Bullet>Free for your first client — full feature set.</Bullet>
            <Bullet>
              Bring your own brand: name, accent color, logo, your couples
              never see &ldquo;wedding-os&rdquo;.
            </Bullet>
            <Bullet>
              Your data lives in your org. Cancel and we hand it back as
              JSON + bucket exports.
            </Bullet>
          </ul>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
          <SignupForm />
        </div>
      </main>
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
