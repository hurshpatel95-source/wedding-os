"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SITE_THEMES, type SiteThemeSlug } from "@/lib/tier1-types";
import { cn } from "@/lib/utils";

// Mirrors SLUG_RE in apps/web/app/api/public-site/route.ts.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$/;

/**
 * Lowercase, swap whitespace + invalid chars for dashes, collapse runs, strip
 * leading/trailing dashes, cap at 62 chars. Audit #28: live slug feedback so
 * users don't get a server-side reject after typing.
 */
function cleanSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 62)
    .replace(/-+$/g, "");
}

interface ScheduleItem {
  time?: string;
  date?: string;
  label: string;
  location?: string;
}
interface FaqItem {
  q: string;
  a: string;
}

interface Props {
  initial: {
    public_slug: string;
    story_html: string;
    registry_url: string;
    registry_label: string;
    travel_md: string;
    hotel_block_md: string;
    dress_code_md: string;
    faq: FaqItem[];
    schedule: ScheduleItem[];
    public_theme_slug: string;
  };
  isPublished: boolean;
  publicSlug: string | null;
}

const THEME_SWATCHES: Record<SiteThemeSlug, string> = {
  classic: "bg-gradient-to-br from-amber-50 via-white to-rose-100",
  modern: "bg-gradient-to-br from-white to-stone-200",
  garden: "bg-gradient-to-br from-emerald-50 via-white to-emerald-100",
  beach: "bg-gradient-to-br from-sky-100 via-amber-50 to-amber-100",
  bollywood: "bg-gradient-to-br from-amber-200 via-pink-200 to-pink-400",
};

export function PublicSiteEditor({ initial, isPublished, publicSlug }: Props) {
  const router = useRouter();
  const [slug, setSlug] = useState(initial.public_slug);
  const [story, setStory] = useState(initial.story_html);
  const [regUrl, setRegUrl] = useState(initial.registry_url);
  const [regLabel, setRegLabel] = useState(initial.registry_label);
  const [travel, setTravel] = useState(initial.travel_md);
  const [hotel, setHotel] = useState(initial.hotel_block_md);
  const [dress, setDress] = useState(initial.dress_code_md);
  const [faq, setFaq] = useState<FaqItem[]>(initial.faq);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initial.schedule);
  const [theme, setTheme] = useState<string>(initial.public_theme_slug);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Audit #30: dirty/clean distinction so the "Saved" pill doesn't persist
  // forever after the first save. Any field-change effect below flips dirty=true.
  const [dirty, setDirty] = useState(false);
  // Audit #31: confirm dialog when publishing an essentially-empty site.
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  // Mark dirty whenever any tracked input changes. Mount-pass is skipped via
  // initial dirty=false; the effect just flips it on first real edit.
  useEffect(() => {
    setDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slug,
    story,
    regUrl,
    regLabel,
    travel,
    hotel,
    dress,
    faq,
    schedule,
    theme,
  ]);

  const cleanedSlug = cleanSlug(slug);
  const slugValid = cleanedSlug.length >= 3 && SLUG_RE.test(cleanedSlug);
  const slugWillChange = cleanedSlug !== slug;

  const save = async (publish?: boolean) => {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/public-site", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          public_slug: slug || null,
          story_html: story,
          registry_url: regUrl || null,
          registry_label: regLabel || null,
          travel_md: travel || null,
          hotel_block_md: hotel || null,
          dress_code_md: dress || null,
          faq,
          schedule,
          public_theme_slug: theme,
          publish,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't save.");
        toast.error(data.error ?? "Couldn't save.");
        return;
      }
      setSavedAt(Date.now());
      setDirty(false);
      if (publish === true) toast.success("Published — your URL is live");
      else if (publish === false) toast.success("Unpublished — guests can't reach the site");
      else toast.success("Site saved");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 py-5">
          <div>
            <h3 className="font-serif text-xl">URL + story</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Your shareable link: /w/<b>{slug || "your-slug"}</b>
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="slug">URL slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="nisha-and-hursh"
                disabled={saving}
                aria-invalid={slug.length > 0 && !slugValid}
              />
              {slug.length > 0 && slugWillChange && slugValid && (
                <p className="text-[11px] text-stone-500">
                  Will save as: <code className="font-medium">{cleanedSlug}</code>
                </p>
              )}
              {slug.length > 0 && !slugValid && (
                <p className="text-[11px] text-amber-700">
                  Slug must be 3–62 characters: lowercase letters, numbers, and
                  dashes (not starting or ending with a dash).
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>&nbsp;</Label>
              <p className="text-[11px] text-muted-foreground">
                Lowercase letters, numbers, and dashes. 3–62 characters.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="story">Our story (Markdown)</Label>
            <Textarea
              id="story"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={6}
              placeholder="We met in 2017..."
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <div>
            <h3 className="font-serif text-xl">Theme</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Visual style for your /w/{slug || "your-slug"} page. Same
              content, different vibe.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SITE_THEMES.map((t) => {
              const selected = theme === t.slug;
              const swatch = THEME_SWATCHES[t.slug];
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => setTheme(t.slug)}
                  disabled={saving}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border bg-white p-4 text-left transition disabled:opacity-60",
                    selected
                      ? "border-stone-900 ring-2 ring-stone-900/20"
                      : "border-stone-200 hover:border-stone-400",
                  )}
                  aria-pressed={selected}
                >
                  <div
                    className={cn(
                      "h-16 w-full rounded-xl border border-white/40",
                      swatch,
                    )}
                  />
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <div className="font-serif text-base font-medium">
                      {t.label}
                    </div>
                    {selected && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-stone-600">
                    {t.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <h3 className="font-serif text-xl">Registry</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reg_url">Registry URL</Label>
              <Input
                id="reg_url"
                value={regUrl}
                onChange={(e) => setRegUrl(e.target.value)}
                placeholder="https://www.zola.com/..."
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg_label">Button label</Label>
              <Input
                id="reg_label"
                value={regLabel}
                onChange={(e) => setRegLabel(e.target.value)}
                placeholder="View our registry"
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <h3 className="font-serif text-xl">Schedule</h3>
          <p className="text-xs text-muted-foreground">
            Each row: optional date/time + label + optional location. Renders
            as a stacked timeline on the public site.
          </p>
          <div className="space-y-2">
            {schedule.map((item, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-lg border border-stone-200 p-3 md:grid-cols-[120px_120px_1fr_1fr_auto]"
              >
                <Input
                  value={item.date ?? ""}
                  onChange={(e) =>
                    setSchedule((s) =>
                      s.map((x, idx) =>
                        idx === i ? { ...x, date: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="Sat Sep 11"
                  disabled={saving}
                />
                <Input
                  value={item.time ?? ""}
                  onChange={(e) =>
                    setSchedule((s) =>
                      s.map((x, idx) =>
                        idx === i ? { ...x, time: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="6:00 PM"
                  disabled={saving}
                />
                <Input
                  value={item.label}
                  onChange={(e) =>
                    setSchedule((s) =>
                      s.map((x, idx) =>
                        idx === i ? { ...x, label: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="Welcome / Sangeet"
                  disabled={saving}
                />
                <Input
                  value={item.location ?? ""}
                  onChange={(e) =>
                    setSchedule((s) =>
                      s.map((x, idx) =>
                        idx === i ? { ...x, location: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="Casa Del Mar, Sitges"
                  disabled={saving}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setSchedule((s) => s.filter((_, idx) => idx !== i))
                  }
                  disabled={saving}
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSchedule((s) => [...s, { label: "" }])}
              disabled={saving}
            >
              <Plus className="h-4 w-4" />
              Add event
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <h3 className="font-serif text-xl">Travel + hotel block</h3>
          <div className="space-y-1.5">
            <Label htmlFor="travel">Travel info (Markdown)</Label>
            <Textarea
              id="travel"
              value={travel}
              onChange={(e) => setTravel(e.target.value)}
              rows={5}
              placeholder="Fly into Barcelona-El Prat (BCN). Sitges is 30 min south by train…"
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hotel">Hotel block (Markdown)</Label>
            <Textarea
              id="hotel"
              value={hotel}
              onChange={(e) => setHotel(e.target.value)}
              rows={5}
              placeholder="We've reserved rooms at ME Sitges Terramar. Use code NISHURSH for €180/night through July 1, 2027."
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <h3 className="font-serif text-xl">Dress code</h3>
          <Textarea
            value={dress}
            onChange={(e) => setDress(e.target.value)}
            rows={3}
            placeholder="Formal Indian attire encouraged. Saris, sherwanis, and lehengas welcome. Cocktail formal works too."
            disabled={saving}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <h3 className="font-serif text-xl">FAQ</h3>
          <div className="space-y-2">
            {faq.map((item, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-stone-200 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={item.q}
                    onChange={(e) =>
                      setFaq((f) =>
                        f.map((x, idx) =>
                          idx === i ? { ...x, q: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Can I bring a plus-one?"
                    disabled={saving}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFaq((f) => f.filter((_, idx) => idx !== i))}
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={item.a}
                  onChange={(e) =>
                    setFaq((f) =>
                      f.map((x, idx) =>
                        idx === i ? { ...x, a: e.target.value } : x,
                      ),
                    )
                  }
                  rows={2}
                  placeholder="Plus-ones are listed on your invitation. If you didn't see one and think you should have, message us."
                  disabled={saving}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFaq((f) => [...f, { q: "", a: "" }])}
              disabled={saving}
            >
              <Plus className="h-4 w-4" />
              Add Q&A
            </Button>
          </div>
        </CardContent>
      </Card>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Spacer so the fixed save bar (below) doesn't cover content. */}
      <div aria-hidden className="h-20" />

      {/*
        Audit #44: pinned to the viewport (fixed bottom-0 …) instead of the
        page-scroll container — the previous `sticky bottom-0` meant the bar
        only appeared after scrolling past all 7-8 cards.
        Audit #30: dirty/saving/saved indicator instead of a permanent "Saved".
      */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="container flex flex-wrap items-center justify-end gap-2 py-3">
          {dirty && saving && (
            <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
              Saving…
            </span>
          )}
          {dirty && !saving && (
            <span className="text-[10px] uppercase tracking-[0.2em] text-amber-700">
              Unsaved changes
            </span>
          )}
          {!dirty && savedAt && (
            <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Saved
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => save()}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </Button>
          <Button
            type="button"
            onClick={() => {
              // Audit #31: confirm before publishing an essentially-empty site.
              const essentiallyEmpty =
                !story.trim() &&
                schedule.length === 0 &&
                faq.length === 0 &&
                !regUrl.trim();
              if (!isPublished && essentiallyEmpty) {
                setPublishConfirmOpen(true);
                return;
              }
              save(!isPublished);
            }}
            disabled={saving || !slug}
          >
            <Send className="h-4 w-4" />
            {isPublished ? "Unpublish" : "Save + Publish"}
          </Button>
        </div>
      </div>

      {/* Empty-publish confirm dialog (audit #31) */}
      <Dialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish a mostly-empty site?</DialogTitle>
            <DialogDescription>
              Your public site has no story, schedule, FAQ, or registry yet.
              Guests who land on it will see almost nothing. Publish anyway?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPublishConfirmOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPublishConfirmOpen(false);
                save(true);
              }}
            >
              <Send className="h-4 w-4" />
              Publish anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {publicSlug && isPublished && (
        <p className="text-center text-xs text-muted-foreground">
          Live at <code>/w/{publicSlug}</code> — share this link with guests.
        </p>
      )}
    </div>
  );
}
