// Polished "this feature is locked, here's what it does" card.
// Renders inline on a route when the underlying integration isn't wired
// up yet. The friend can browse + understand the value without setup.

import { Lock, Sparkles } from "lucide-react";
import { getFeatureSpec, type FeatureKey } from "@/lib/feature-flags";

export function FeaturePreviewCard({
  feature,
  variant = "page",
}: {
  feature: FeatureKey;
  variant?: "page" | "inline";
}) {
  const spec = getFeatureSpec(feature);

  if (variant === "inline") {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <Lock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-serif text-base font-medium tracking-tight">
                {spec.label}
              </h4>
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-700">
                Setup pending
              </span>
            </div>
            <p className="mt-1 text-sm text-stone-700">{spec.oneLiner}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-amber-50/40 via-white to-rose-50/30">
      <div className="border-b border-stone-200 bg-white/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-amber-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" fill="white" />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-serif text-2xl font-light tracking-tight">
                {spec.label}
              </h2>
              <span className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-stone-600">
                Setup pending
              </span>
            </div>
            <p className="mt-1 text-sm text-stone-700">{spec.oneLiner}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
            What this unlocks
          </div>
          <ul className="mt-3 space-y-2">
            {spec.whatItDoes.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-800">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
            For example
          </div>
          <div className="mt-3 space-y-3">
            {spec.exampleScenarios.map((s, i) => (
              <blockquote
                key={i}
                className="rounded-2xl border-l-4 border-rose-300 bg-white/70 px-4 py-3 text-sm italic leading-relaxed text-stone-800"
              >
                {s}
              </blockquote>
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-stone-200 bg-white/60 px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-stone-600">
            Tell Hursh you&rsquo;d use this — he&rsquo;ll wire it up.
          </p>
          <a
            href="/feature-status"
            className="text-xs font-medium text-rose-700 underline-offset-2 hover:underline"
          >
            See all features →
          </a>
        </div>
      </div>
    </div>
  );
}
