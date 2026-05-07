"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { OrgPublicRow } from "@/lib/lead-types";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

export function BookingSettingsForm({ org }: { org: OrgPublicRow }) {
  const router = useRouter();
  const [slug, setSlug] = useState(org.public_slug ?? "");
  const [tagline, setTagline] = useState(org.public_tagline ?? "");
  const [brandMd, setBrandMd] = useState(org.public_brand_md ?? "");
  const [phone, setPhone] = useState(org.contact_phone ?? "");
  const [email, setEmail] = useState(org.contact_email ?? "");
  const [slotMinutes, setSlotMinutes] = useState(org.booking_slot_minutes ?? 45);
  const [bufferMinutes, setBufferMinutes] = useState(
    org.booking_buffer_minutes ?? 30,
  );
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState(!!org.public_published_at);

  const isPublishable =
    !!slug &&
    SLUG_RE.test(slug) &&
    (tagline.trim().length > 0 || brandMd.trim().length > 0);

  const save = async (publish?: boolean) => {
    if (slug && !SLUG_RE.test(slug)) {
      toast.error("Slug must be lowercase letters, numbers, hyphens.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/booking/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          public_slug: slug || null,
          public_tagline: tagline,
          public_brand_md: brandMd,
          contact_phone: phone,
          contact_email: email,
          booking_slot_minutes: slotMinutes,
          booking_buffer_minutes: bufferMinutes,
          publish: publish === true ? true : publish === false ? false : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not save");
      }
      const j = await res.json();
      setPublished(!!j.published);
      toast.success(
        publish === true
          ? "Published — your booking page is live"
          : publish === false
            ? "Unpublished"
            : "Saved",
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const liveUrl = slug ? `/book/${slug}` : null;

  return (
    <section className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-light tracking-tight">
            Public listing
          </h2>
          <p className="text-xs text-stone-500">
            What couples see at <code className="rounded bg-stone-100 px-1.5 py-0.5">/book/&lt;slug&gt;</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {published ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-stone-600">
              Draft
            </span>
          )}
          {liveUrl && published && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:border-stone-500"
            >
              View live <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Public slug" hint="lowercase, hyphens only">
          <div className="flex items-center rounded-md border border-stone-300 bg-white">
            <span className="px-3 text-xs text-stone-400">/book/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="astia-events"
              className="flex-1 bg-transparent py-2 pr-3 text-sm focus:outline-none"
            />
          </div>
        </Field>
        <Field label="Tagline (1 line)">
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Destination weddings, Barcelona-based"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <Field label="About (Markdown)" hint="Pricing, philosophy, what working with you looks like">
        <textarea
          value={brandMd}
          onChange={(e) => setBrandMd(e.target.value)}
          rows={8}
          placeholder={"## What we do\n\nFull-service planning for destination weddings…"}
          className="w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Contact phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+34 600 000 000"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Contact email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hello@yourstudio.com"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Slot duration (minutes)">
          <input
            type="number"
            min={15}
            max={180}
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Buffer between calls (minutes)">
          <input
            type="number"
            min={0}
            max={120}
            value={bufferMinutes}
            onChange={(e) => setBufferMinutes(Number(e.target.value))}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-stone-100 pt-5">
        <button
          type="button"
          onClick={() => save()}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-500 disabled:opacity-60"
        >
          Save draft
        </button>
        {!published ? (
          <button
            type="button"
            onClick={() => save(true)}
            disabled={busy || !isPublishable}
            className="inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
            title={!isPublishable ? "Set a slug + tagline or about copy first" : ""}
          >
            Publish booking page
          </button>
        ) : (
          <button
            type="button"
            onClick={() => save(false)}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-white px-5 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
          >
            Unpublish
          </button>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
          {label}
        </span>
        {hint && <span className="text-[10px] text-stone-400">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
