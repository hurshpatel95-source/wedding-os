"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  };
  isPublished: boolean;
  publicSlug: string | null;
}

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
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
              />
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
                  placeholder="Plus-ones are listed on your invitation. If you didn't see one and think you should have, message Hursh."
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

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 bg-white/90 px-4 py-3 backdrop-blur md:rounded-xl md:border md:bg-white">
        {savedAt && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">
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
          onClick={() => save(!isPublished)}
          disabled={saving || !slug}
        >
          <Send className="h-4 w-4" />
          {isPublished ? "Unpublish" : "Save + Publish"}
        </Button>
      </div>
      {publicSlug && isPublished && (
        <p className="text-center text-xs text-muted-foreground">
          Live at <code>/w/{publicSlug}</code> — share this link with guests.
        </p>
      )}
    </div>
  );
}
