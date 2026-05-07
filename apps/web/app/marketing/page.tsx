import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  Heart,
  Inbox,
  Library,
  MessageCircle,
  Receipt,
  Sparkles,
  Users,
} from "lucide-react";

export const dynamic = "force-static";

export const metadata = {
  title: "wedding-os · The OS for wedding planners",
  description:
    "Run your studio like the best ones do. Library, playbook, vendor CRM, billing, lead pipeline, public site, AI co-pilot — all in one place.",
};

export default function MarketingLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-white to-rose-50/30 text-stone-900">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-stone-200/40 bg-white/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
          <Link href="/marketing" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-amber-600 shadow-sm">
              <Heart className="h-4 w-4 text-white" fill="white" />
            </div>
            <span className="font-serif text-lg font-medium tracking-tight">
              wedding-os
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-stone-600 md:flex">
            <a href="#features" className="hover:text-stone-900">
              Features
            </a>
            <a href="#why" className="hover:text-stone-900">
              Why we built it
            </a>
            <a href="#pricing" className="hover:text-stone-900">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm font-medium text-stone-700 hover:text-stone-900"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              Start free
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center md:py-32">
        <div className="text-[10px] uppercase tracking-[0.4em] text-stone-500">
          The OS for wedding planners
        </div>
        <h1 className="mt-6 font-serif text-5xl font-light leading-tight tracking-tight md:text-7xl">
          Run your studio
          <br />
          <span className="bg-gradient-to-r from-rose-600 to-amber-700 bg-clip-text text-transparent">
            like the best ones do.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-stone-700">
          Library, playbook, vendor CRM, billing, lead pipeline, public
          wedding sites, AI co-pilot — all in one place. Built by a planner
          for planners. Replaces Aisle Planner, Honeybook, Plannit, and
          half a dozen spreadsheets.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800"
          >
            Start free — no card needed
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-6 py-3 text-sm font-medium text-stone-800 transition hover:border-stone-500"
          >
            See how it works
          </Link>
        </div>
        <p className="mt-4 text-xs text-stone-500">
          No credit card · Free forever for your first client
        </p>
      </section>

      {/* Logo strip placeholder */}
      <section className="mx-auto max-w-5xl px-6 pb-10">
        <p className="text-center text-[10px] uppercase tracking-[0.3em] text-stone-400">
          Designed with planners running 5–25 weddings a year
        </p>
      </section>

      {/* Why */}
      <section id="why" className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
          Why we built it
        </div>
        <h2 className="mt-2 font-serif text-3xl font-light tracking-tight md:text-5xl">
          Most planner tools are bolt-on form tools dressed as software.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-stone-700">
          Aisle Planner is a 2014-era checklist. Honeybook is a CRM with a
          contract templates layer. Plannit&rsquo;s great until you have a
          second client. None of them know what your library is, none of
          them write your client&rsquo;s update emails for you, and none
          have a real production playbook.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-stone-700">
          wedding-os is opinionated about how a planner&rsquo;s week
          actually flows: a single inbox of every overdue task across every
          client, a venue + vendor library you build once and clone for
          every couple, AI that drafts the vendor RFP and the guest
          save-the-date. The kind of tool you&rsquo;d build for yourself if
          you had three months.
        </p>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
            What&rsquo;s in the box
          </div>
          <h2 className="mt-2 font-serif text-4xl font-light tracking-tight md:text-5xl">
            Everything your studio needs
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-stone-700">
            One product, ten tools. No integrations to wire up, no
            spreadsheets to maintain, no Notion-Calendly-Stripe-Mailchimp tax.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={Inbox}
            title="Studio inbox"
            body="Every overdue task across every client, in one ranked list. The fastest way to triage your morning."
          />
          <Feature
            icon={Library}
            title="Library"
            body="Build your venues + vendors once. Clone any of them into a new client&rsquo;s workspace with one click."
          />
          <Feature
            icon={BookOpen}
            title="Playbook"
            body="Your master 12-month plan. Apply it to every new couple — they get your phases, your tasks, your sequencing."
          />
          <Feature
            icon={Briefcase}
            title="Vendor CRM"
            body="RFP drafts. Status pills. Quote tracking. Files. The whole vendor side of the wedding, in one tab."
          />
          <Feature
            icon={Users}
            title="Guest list + RSVP"
            body="AI ingests their messy Excel. Couples self-serve RSVPs at /rsvp/<token>. Dietary, allergies, plus-ones."
          />
          <Feature
            icon={Receipt}
            title="Planner billing"
            body="Track retainers, milestone fees. Couples see what they owe at /payments — your read-only ledger."
          />
          <Feature
            icon={Sparkles}
            title="AI co-pilot"
            body="Workspace-aware Claude. Knows your venues, vendors, guests, budget. Answers in seconds, drafts emails."
          />
          <Feature
            icon={MessageCircle}
            title="Public wedding site"
            body="Every couple gets a /w/<slug> share-ready site — schedule, registry, hotel block, RSVP, all branded to your studio."
          />
          <Feature
            icon={Calendar}
            title="Booking page"
            body="Calendly-style consult booking at /book/<your-slug>. Inquiries flow into your lead pipeline automatically."
          />
          <Feature
            icon={BarChart3}
            title="Studio analytics"
            body="Revenue YTD. Outstanding. Client roster countdowns. Vendor mix across all your clients. KPIs that matter."
          />
          <Feature
            icon={Heart}
            title="Branded couple shell"
            body="Each client&rsquo;s workspace wears your studio&rsquo;s brand — accent color, logo, name. They feel like they&rsquo;re using your tool."
          />
          <Feature
            icon={ArrowRight}
            title="Lead pipeline"
            body="Inquiries from your booking page + couple referrals from public sites. Convert any lead into a client in one click."
          />
        </div>
      </section>

      {/* Big quote */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center md:py-24">
        <blockquote className="font-serif text-3xl font-light italic leading-snug tracking-tight text-stone-800 md:text-4xl">
          &ldquo;Built for planners who want their tool to think like they do —
          not for planners who want a CRM with a wedding theme.&rdquo;
        </blockquote>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
            Pricing
          </div>
          <h2 className="mt-2 font-serif text-4xl font-light tracking-tight">
            Start free, pay when it pays for itself
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-stone-700">
            No card to try. Every feature, including AI, is in the free tier
            for your first client.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <PricingCard
            name="Free"
            price="€0"
            cadence="forever"
            features={[
              "1 client workspace",
              "Library + playbook",
              "Public booking page",
              "AI co-pilot (30 msg/day)",
              "Public wedding site",
            ]}
          />
          <PricingCard
            name="Studio"
            price="€49"
            cadence="per month"
            featured
            features={[
              "Up to 12 active clients",
              "Everything in Free",
              "Vendor CRM + AI emails",
              "Marketing scorecard agent",
              "Billing + invoice tracking",
              "Priority support",
            ]}
          />
          <PricingCard
            name="Atelier"
            price="Let's talk"
            cadence="custom"
            features={[
              "Unlimited workspaces",
              "Multi-team support",
              "Custom branding",
              "Dedicated success",
              "API access",
            ]}
          />
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            Start free — your first client is on us
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white/50 py-12 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-stone-500">
          wedding-os
        </div>
        <div className="mt-2 text-xs text-stone-400">
          Built by planners. For planners. Made in Barcelona.
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/70 p-6 backdrop-blur">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-amber-100">
        <Icon className="h-5 w-5 text-rose-700" />
      </div>
      <h3 className="mt-4 font-serif text-xl font-medium tracking-tight">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone-700">{body}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  cadence,
  features,
  featured,
}: {
  name: string;
  price: string;
  cadence: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-6 ${
        featured
          ? "border-2 border-stone-900 bg-white shadow-lg"
          : "border border-stone-200 bg-white/70"
      }`}
    >
      {featured && (
        <div className="-mt-9 mb-4 flex justify-center">
          <span className="rounded-full bg-stone-900 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-white">
            Most popular
          </span>
        </div>
      )}
      <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">
        {name}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-serif text-4xl font-light tracking-tight">
          {price}
        </span>
        <span className="text-xs text-stone-500">{cadence}</span>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-stone-700">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
