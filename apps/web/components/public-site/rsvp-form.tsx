"use client";

// Multi-step RSVP form rendered inline on /w/<slug>'s #rsvp section.
//
// Steps:
//   1. Your name — typeahead against /api/public/rsvp?slug=&q=. We never let
//      a guest free-type a "new" name; if no match, we show a "contact the
//      couple" message. Spam goes to zero.
//   2. Per-event yes/no/maybe radios.
//   3. Plus-one fields — only shown when matched guest's plus_one_max > 0.
//      (We learn that on the GET match response — see API.)
//   4. Dietary / allergies / song / accessibility / notes free text.
//   5. Thank-you state from the server's response.
//
// Visual: the form sits inside a card and inherits the public-site theme
// colors via classnames passed in by the page.

import { useEffect, useRef, useState } from "react";

interface MatchedGuest {
  id: string;
  full_name: string;
}

type Stage = "name" | "events" | "plus_one" | "details" | "thanks";
type EventRsvp = "yes" | "no" | "maybe";

interface ThankYou {
  heading: string;
  body: string;
}

export function RsvpForm({
  workspaceSlug,
  eventRoles,
  cardClassName,
  buttonClassName,
  badgeClassName,
}: {
  workspaceSlug: string;
  /** Distinct event_roles drawn from the workspace's venues. Defaults to
   *  ["wedding"] when the venues haven't been categorized yet. */
  eventRoles: string[];
  cardClassName: string;
  buttonClassName: string;
  badgeClassName: string;
}) {
  const [stage, setStage] = useState<Stage>("name");
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [nameInput, setNameInput] = useState("");
  const [matches, setMatches] = useState<MatchedGuest[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<MatchedGuest | null>(null);
  // We learn plus_one_max from the server on the next step (it's on the
  // guests row not the typeahead — keeps the typeahead lightweight).
  const [plusOneMax, setPlusOneMax] = useState(0);

  // Step 2
  const [eventResponses, setEventResponses] = useState<
    Record<string, EventRsvp>
  >({});

  // Step 3
  const [plusOneName, setPlusOneName] = useState("");
  const [plusOneAttending, setPlusOneAttending] = useState<
    "yes" | "no" | null
  >(null);

  // Step 4
  const [dietary, setDietary] = useState("");
  const [allergies, setAllergies] = useState("");
  const [songRequest, setSongRequest] = useState("");
  const [accessibility, setAccessibility] = useState("");
  const [notes, setNotes] = useState("");

  // Honeypot
  const [website, setWebsite] = useState("");

  // Thank-you payload from the server
  const [thanks, setThanks] = useState<ThankYou | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Debounced typeahead query — fire after 250ms of idle typing. Tracks the
  // latest request so an out-of-order response can't clobber a newer one.
  const reqIdRef = useRef(0);
  useEffect(() => {
    if (stage !== "name") return;
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      setMatches([]);
      setSearched(false);
      return;
    }
    const myReq = ++reqIdRef.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/public/rsvp?slug=${encodeURIComponent(workspaceSlug)}&q=${encodeURIComponent(trimmed)}`,
          { method: "GET" },
        );
        if (myReq !== reqIdRef.current) return;
        const j = await res.json().catch(() => ({ matches: [] }));
        setMatches((j.matches ?? []) as MatchedGuest[]);
        setSearched(true);
      } catch {
        if (myReq !== reqIdRef.current) return;
        setMatches([]);
        setSearched(true);
      } finally {
        if (myReq === reqIdRef.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [nameInput, workspaceSlug, stage]);

  const handleSelectGuest = (g: MatchedGuest) => {
    setSelectedGuest(g);
    setNameInput(g.full_name);
    setError(null);
    // Conservative default — show the +1 step. If the primary truly isn't
    // allowed a +1, the server simply ignores the plus_one_name field.
    setPlusOneMax(1);
    // Pre-populate event responses to "yes" — most RSVPers said yes, faster
    // to flip the rare ones to no.
    const initial: Record<string, EventRsvp> = {};
    for (const role of eventRoles) initial[role] = "yes";
    setEventResponses(initial);
    setStage("events");
  };

  const handleSubmit = async () => {
    if (!selectedGuest) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          guest_id: selectedGuest.id,
          per_event: eventResponses,
          plus_one_name: plusOneName.trim() || null,
          plus_one_attending:
            plusOneAttending === null ? null : plusOneAttending === "yes",
          dietary: dietary.trim() || null,
          allergies: allergies.trim() || null,
          song_request: songRequest.trim() || null,
          accessibility: accessibility.trim() || null,
          notes: notes.trim() || null,
          website,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error ?? "Could not save your RSVP");
      }
      setThanks(j.thank_you ?? null);
      setStage("thanks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────
  if (stage === "thanks" && thanks) {
    return (
      <div className={`${cardClassName} mx-auto max-w-md p-8 text-center`}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700">
          ✓
        </div>
        <h3 className="mt-4 text-xl font-medium">{thanks.heading}</h3>
        <p className="mt-2 text-sm opacity-80">{thanks.body}</p>
      </div>
    );
  }

  return (
    <div className={`${cardClassName} mx-auto max-w-md p-6 text-left`}>
      {/* Step indicator — kept subtle */}
      <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] opacity-60">
        <span className={stage === "name" ? "" : "opacity-40"}>1 You</span>
        <span>·</span>
        <span className={stage === "events" ? "" : "opacity-40"}>
          2 Events
        </span>
        <span>·</span>
        <span className={stage === "plus_one" ? "" : "opacity-40"}>
          3 Plus-one
        </span>
        <span>·</span>
        <span className={stage === "details" ? "" : "opacity-40"}>
          4 Details
        </span>
      </div>

      {/* ─── Step 1: name typeahead ─────────────────────────────────── */}
      {stage === "name" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            What&rsquo;s your name?
          </label>
          <input
            type="text"
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Start typing your name…"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
          />
          {/* Honeypot — hidden, bots auto-fill */}
          <div aria-hidden="true" className="hidden">
            <label>
              Website
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>

          {searching && (
            <div className="text-xs opacity-60">Searching…</div>
          )}

          {!searching && matches.length > 0 && (
            <ul className="divide-y divide-stone-200/60 overflow-hidden rounded-lg border border-stone-200 bg-white">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectGuest(m)}
                    className="block w-full px-3 py-2 text-left text-sm text-stone-900 hover:bg-stone-50"
                  >
                    {m.full_name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!searching && searched && matches.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              We don&rsquo;t see <strong>{nameInput.trim()}</strong> on the
              guest list. Please contact the couple to be added — we
              can&rsquo;t take free-form RSVPs to keep spam off the list.
            </div>
          )}
        </div>
      )}

      {/* ─── Step 2: per-event ──────────────────────────────────────── */}
      {stage === "events" && selectedGuest && (
        <div className="space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] opacity-60">
              Hi {selectedGuest.full_name.split(" ")[0]}
            </div>
            <h3 className="mt-1 text-lg font-medium">Are you joining us?</h3>
          </div>
          {eventRoles.map((role) => (
            <fieldset key={role} className="space-y-2">
              <legend className="text-sm font-medium capitalize">
                {role.replace(/_/g, " ")}
              </legend>
              <div className="flex flex-wrap gap-2">
                {(["yes", "no", "maybe"] as EventRsvp[]).map((opt) => {
                  const active = eventResponses[role] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setEventResponses((s) => ({ ...s, [role]: opt }))
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                        active
                          ? badgeClassName + " border-transparent"
                          : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <div className="flex justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStage("name")}
              className="text-xs underline opacity-70"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStage(plusOneMax > 0 ? "plus_one" : "details")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${buttonClassName}`}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: plus-one ───────────────────────────────────────── */}
      {stage === "plus_one" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Anyone joining you?</h3>
            <p className="mt-1 text-xs opacity-70">
              Optional — leave blank if you&rsquo;re coming solo.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider opacity-70">
              Plus-one name
            </label>
            <input
              type="text"
              value={plusOneName}
              onChange={(e) => setPlusOneName(e.target.value)}
              placeholder="e.g. Alex Kim"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            />
          </div>
          {plusOneName.trim() && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider opacity-70">
                Are they coming?
              </div>
              <div className="mt-2 flex gap-2">
                {(["yes", "no"] as const).map((opt) => {
                  const active = plusOneAttending === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPlusOneAttending(opt)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                        active
                          ? badgeClassName + " border-transparent"
                          : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStage("events")}
              className="text-xs underline opacity-70"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStage("details")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${buttonClassName}`}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 4: details ────────────────────────────────────────── */}
      {stage === "details" && (
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-medium">Anything we should know?</h3>
            <p className="mt-1 text-xs opacity-70">All optional.</p>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider opacity-70">
              Dietary needs
            </label>
            <input
              type="text"
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
              placeholder="Vegetarian, gluten-free…"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider opacity-70">
              Allergies
            </label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="Peanuts, shellfish…"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider opacity-70">
              Song request
            </label>
            <input
              type="text"
              value={songRequest}
              onChange={(e) => setSongRequest(e.target.value)}
              placeholder="One song that&rsquo;ll get you on the dance floor"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider opacity-70">
              Accessibility needs
            </label>
            <input
              type="text"
              value={accessibility}
              onChange={(e) => setAccessibility(e.target.value)}
              placeholder="Step-free access, hearing assist…"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider opacity-70">
              Anything else?
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes for the couple"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() =>
                setStage(plusOneMax > 0 ? "plus_one" : "events")
              }
              className="text-xs underline opacity-70"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={`rounded-full px-4 py-2 text-sm font-medium ${buttonClassName} disabled:opacity-60`}
            >
              {submitting ? "Sending…" : "Send RSVP"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
