import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";
import { listAllFeatures } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default function FeatureStatusPage() {
  const features = listAllFeatures();
  const live = features.filter((f) => f.ready);
  const pending = features.filter((f) => !f.ready);

  return (
    <div className="space-y-10">
      <header>
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">
          Tour
        </div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight md:text-5xl">
          Everything Acquired Planner does
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-700">
          Some pieces are live for you right now. Others depend on third-party
          API keys that haven&rsquo;t been wired up yet. Tap any item to see
          what it would do once turned on.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Stat
          label="Live now"
          value={live.length}
          tone="emerald"
          sub="ready to use"
        />
        <Stat
          label="Setup pending"
          value={pending.length}
          tone="amber"
          sub="needs API keys"
        />
        <Stat
          label="Total features"
          value={features.length}
          tone="stone"
          sub="across the platform"
        />
      </section>

      {live.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-serif text-2xl font-light tracking-tight">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Live now ({live.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {live.map((f) => (
              <article
                key={f.key}
                className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 transition hover:border-emerald-400 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-lg font-medium tracking-tight">
                    {f.label}
                  </h3>
                  <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-900">
                    Live
                  </span>
                </div>
                <p className="mt-2 text-sm text-stone-700">{f.oneLiner}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-serif text-2xl font-light tracking-tight">
            <Lock className="h-5 w-5 text-amber-700" />
            Setup pending ({pending.length})
          </h2>
          <p className="mb-4 max-w-2xl text-sm text-stone-600">
            These features are built and tested — they just need their
            third-party API keys configured. Below is what each one does and
            the value it adds. Tell us which ones you&rsquo;d actually use
            and we&rsquo;ll turn them on.
          </p>
          <div className="grid gap-4">
            {pending.map((f) => (
              <article
                key={f.key}
                className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-xl font-medium tracking-tight">
                      {f.label}
                    </h3>
                    <p className="mt-1 text-sm text-stone-700">{f.oneLiner}</p>
                  </div>
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-900">
                    Pending
                  </span>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-[1.4fr_1fr]">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
                      What it unlocks
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {f.whatItDoes.map((b, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-stone-800"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
                      For example
                    </div>
                    <div className="mt-2 space-y-2">
                      {f.exampleScenarios.map((s, i) => (
                        <blockquote
                          key={i}
                          className="rounded-xl border-l-4 border-rose-300 bg-stone-50/60 px-3 py-2 text-xs italic leading-relaxed text-stone-800"
                        >
                          {s}
                        </blockquote>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="rounded-2xl border border-stone-200 bg-stone-50/40 p-5 text-center">
        <p className="text-sm text-stone-700">
          Like what you see? Tell us which features you&rsquo;d use — we
          can turn them on whenever.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Or browse the rest of the app:{" "}
          <Link href="/" className="underline hover:text-stone-900">
            Dashboard
          </Link>
          {" · "}
          <Link href="/autopilot" className="underline hover:text-stone-900">
            Autopilot
          </Link>
          {" · "}
          <Link href="/budget" className="underline hover:text-stone-900">
            Budget
          </Link>
          {" · "}
          <Link href="/vendors" className="underline hover:text-stone-900">
            Vendors
          </Link>
        </p>
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "emerald" | "amber" | "stone";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-stone-200 bg-white";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
        {label}
      </div>
      <div className="mt-1 font-serif text-3xl font-medium tabular-nums">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.15em] opacity-70">
        {sub}
      </div>
    </div>
  );
}
