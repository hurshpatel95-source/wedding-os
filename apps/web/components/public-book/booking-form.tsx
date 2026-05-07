"use client";

import { useMemo, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { toast } from "sonner";
import { BUDGET_BANDS, type BookingWindowRow } from "@/lib/lead-types";

interface SlotOption {
  iso: string;
  dayLabel: string;
  timeLabel: string;
  // Sort key
  ts: number;
}

function buildSlots(
  windows: BookingWindowRow[],
  slotMinutes: number,
  daysAhead = 21,
): SlotOption[] {
  if (!windows.length) return [];
  const out: SlotOption[] = [];
  const now = new Date();
  const start = startOfDay(now);
  for (let d = 0; d < daysAhead; d++) {
    const dayDate = addDays(start, d);
    const dow = dayDate.getDay();
    const todaysWindows = windows.filter((w) => w.day_of_week === dow);
    for (const w of todaysWindows) {
      let m = w.start_minute;
      while (m + slotMinutes <= w.end_minute) {
        const slot = new Date(dayDate);
        slot.setHours(0, 0, 0, 0);
        slot.setMinutes(m);
        // Skip slots that are in the past today
        if (slot.getTime() > now.getTime() + 30 * 60 * 1000) {
          out.push({
            iso: slot.toISOString(),
            dayLabel: format(slot, "EEE MMM d"),
            timeLabel: format(slot, "h:mm a"),
            ts: slot.getTime(),
          });
        }
        m += slotMinutes;
      }
    }
  }
  out.sort((a, b) => a.ts - b.ts);
  return out.slice(0, 32);
}

export function BookingForm({
  orgSlug,
  orgName,
  windows,
  slotMinutes,
}: {
  orgSlug: string;
  orgName: string;
  windows: BookingWindowRow[];
  slotMinutes: number;
}) {
  const slots = useMemo(
    () => buildSlots(windows, slotMinutes ?? 45),
    [windows, slotMinutes],
  );

  const slotsByDay = useMemo(() => {
    const map = new Map<string, SlotOption[]>();
    for (const s of slots) {
      const k = s.dayLabel;
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [slots]);

  const [step, setStep] = useState<"slot" | "details" | "done">("slot");
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [coupleNames, setCoupleNames] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [budgetBand, setBudgetBand] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  // Honeypot — visually hidden field that bots tend to fill
  const [website, setWebsite] = useState("");

  const handleSubmit = async () => {
    if (!email && !phone) {
      toast.error("Please share an email or phone — we need a way to reach you");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orgSlug,
          source: "booking_page",
          couple_names: coupleNames,
          email,
          phone,
          wedding_date: weddingDate || undefined,
          guest_count: guestCount ? Number(guestCount) : undefined,
          budget_band: budgetBand || undefined,
          city_or_region: city,
          notes,
          website,
          scheduled_call_at: selectedSlot?.iso,
          scheduled_call_duration_minutes: slotMinutes,
          page_path: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not submit");
      }
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
          ✓
        </div>
        <h3 className="mt-4 font-serif text-2xl font-light tracking-tight">
          We got it
        </h3>
        <p className="mt-3 text-sm text-stone-700">
          Thanks for reaching out. {orgName} will be in touch
          {selectedSlot ? (
            <>
              {" "}
              before your call on{" "}
              <span className="font-medium text-stone-900">
                {selectedSlot.dayLabel} at {selectedSlot.timeLabel}
              </span>
              .
            </>
          ) : (
            " within one business day."
          )}
        </p>
      </div>
    );
  }

  if (step === "slot") {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
          Step 1 of 2
        </div>
        <h3 className="mt-2 font-serif text-2xl font-light tracking-tight">
          Pick a time to chat
        </h3>
        <p className="mt-2 text-sm text-stone-600">
          {slotMinutes}-minute intro call. No obligation, just a conversation.
        </p>

        {slotsByDay.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
            No call slots set up yet. Use the email or phone above to reach out
            directly, or skip ahead and we&rsquo;ll work it out by message.
            <button
              type="button"
              onClick={() => setStep("details")}
              className="mt-3 inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-4 py-1.5 text-xs font-medium text-stone-700 hover:border-rose-500 hover:text-rose-800"
            >
              Skip slot picker
            </button>
          </div>
        ) : (
          <div className="mt-6 max-h-[320px] space-y-4 overflow-y-auto pr-2">
            {slotsByDay.map(([day, daySlots]) => (
              <div key={day}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                  {day}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {daySlots.map((s) => (
                    <button
                      key={s.iso}
                      type="button"
                      onClick={() => {
                        setSelectedSlot(s);
                        setStep("details");
                      }}
                      className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-rose-500 hover:text-rose-800"
                    >
                      {s.timeLabel}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setStep("details")}
          className="mt-4 text-xs text-stone-500 underline hover:text-stone-800"
        >
          Or just send a message
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
            Step 2 of 2
          </div>
          <h3 className="mt-2 font-serif text-2xl font-light tracking-tight">
            Tell us about your wedding
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setStep("slot")}
          className="text-xs text-stone-500 underline hover:text-stone-800"
        >
          ← Slot
        </button>
      </div>

      {selectedSlot && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          Holding {selectedSlot.dayLabel} at {selectedSlot.timeLabel}
        </div>
      )}

      <div className="mt-4 space-y-3 text-sm">
        <Field label="Names">
          <input
            type="text"
            value={coupleNames}
            onChange={(e) => setCoupleNames(e.target.value)}
            placeholder="Nisha & Hursh"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@example.com"
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Wedding date (rough is fine)">
            <input
              type="date"
              value={weddingDate}
              onChange={(e) => setWeddingDate(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </Field>
          <Field label="Approx guests">
            <input
              type="number"
              min={0}
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="120"
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </Field>
        </div>
        <Field label="Budget range">
          <select
            value={budgetBand}
            onChange={(e) => setBudgetBand(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
          >
            <option value="">Pick a range</option>
            {BUDGET_BANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Where">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Barcelona, Tuscany, Mexico City…"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </Field>
        <Field label="Anything we should know?">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Vibe, must-haves, hopes, fears…"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </Field>
        {/* Honeypot */}
        <div aria-hidden="true" className="hidden">
          <label>
            Website (leave blank)
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
      >
        {submitting ? "Sending…" : selectedSlot ? "Confirm booking" : "Send message"}
      </button>
      <p className="mt-3 text-center text-[11px] text-stone-500">
        We never share your information. Reply STOP to opt out at any time.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
