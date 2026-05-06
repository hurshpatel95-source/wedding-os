"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Heart, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Database } from "@wedding-os/db";

type Venue = Database["public"]["Tables"]["venues"]["Row"];
type Photo = Database["public"]["Tables"]["venue_photos"]["Row"];
type Visit = Database["public"]["Tables"]["venue_visits"]["Row"];

const VIDEO_EXT = /\.(mov|mp4|m4v|webm)$/i;
const isVideo = (url: string) => VIDEO_EXT.test(url);

const BUCKET = "venue-photos";

export function PhotosTab({
  venue,
  userId,
  role,
  initialPhotos,
  visits,
}: {
  venue: Venue;
  userId: string;
  role: "admin" | "couple" | null;
  initialPhotos: Photo[];
  visits: Visit[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadVisitId, setUploadVisitId] = useState<string>("none");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const groups = useMemo(() => groupPhotos(initialPhotos, visits), [initialPhotos, visits]);
  const canEdit = role === "admin" || role === "couple";

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: list.length });

    const supabase = createClient();
    const visitId = uploadVisitId === "none" ? null : uploadVisitId;

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      if (!file) continue;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `${venue.id}/${Date.now()}-${i}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(objectKey, file, { contentType: file.type, upsert: false });

      if (!upErr) {
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectKey);
        await supabase.from("venue_photos").insert({
          venue_id: venue.id,
          visit_id: visitId,
          url: pub.publicUrl,
          caption: file.name,
          uploaded_by: userId,
          taken_at: new Date(file.lastModified).toISOString(),
        });
      }
      setProgress({ done: i + 1, total: list.length });
    }

    setUploading(false);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  };

  const toggleFavorite = async (photo: Photo) => {
    const supabase = createClient();
    const has = (photo.favorited_by ?? []).includes(userId);
    const next = has
      ? (photo.favorited_by ?? []).filter((u) => u !== userId)
      : [...(photo.favorited_by ?? []), userId];
    await supabase.from("venue_photos").update({ favorited_by: next }).eq("id", photo.id);
    router.refresh();
  };

  const removePhoto = async (photo: Photo) => {
    if (!confirm("Delete this photo?")) return;
    const supabase = createClient();
    const path = extractStoragePath(photo.url, venue.id);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    await supabase.from("venue_photos").delete().eq("id", photo.id);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid flex-1 gap-1.5">
                <label className="text-sm font-medium">Link upload to a visit (optional)</label>
                <Select value={uploadVisitId} onValueChange={setUploadVisitId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific visit</SelectItem>
                    {visits.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {format(parseISO(v.visit_date), "PPP")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4" />
                {uploading
                  ? `Uploading ${progress?.done}/${progress?.total}…`
                  : "Pick files"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/quicktime,video/mp4"
                className="hidden"
                onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              />
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "rounded-md border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground transition-colors",
                dragOver && "border-foreground/40 bg-secondary/40",
              )}
            >
              Drop photos or videos here to upload them to{" "}
              <span className="font-medium text-foreground">{venue.name}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No photos yet. {canEdit && "Drop some files above to get started."}
          </CardContent>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-lg">{g.label}</h3>
              <span className="text-xs text-muted-foreground">{g.photos.length} item{g.photos.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {g.photos.map((p) => {
                const fav = (p.favorited_by ?? []).includes(userId);
                return (
                  <div key={p.id} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
                    <button
                      type="button"
                      onClick={() => setLightbox(p)}
                      className="block h-full w-full"
                      aria-label={p.caption ?? "Open photo"}
                    >
                      {isVideo(p.url) ? (
                        <video
                          src={p.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.url}
                          alt={p.caption ?? ""}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      )}
                    </button>
                    {canEdit && (
                      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={fav ? "Unfavorite" : "Favorite"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(p);
                          }}
                        >
                          <Heart className={cn("h-3.5 w-3.5", fav && "fill-red-500 text-red-500")} />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Delete photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePhoto(p);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    {isVideo(p.url) && (
                      <div className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">
                        Video
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {lightbox && (
        <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function Lightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="max-h-full max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo(photo.url) ? (
          <video
            src={photo.url}
            controls
            autoPlay
            playsInline
            className="max-h-[85vh] max-w-[90vw] rounded-md"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.caption ?? ""}
            className="max-h-[85vh] max-w-[90vw] rounded-md object-contain"
          />
        )}
        {photo.caption && (
          <div className="mt-2 text-center text-sm text-white/80">{photo.caption}</div>
        )}
      </div>
    </div>
  );
}

function groupPhotos(
  photos: Photo[],
  visits: Visit[],
): { key: string; label: string; photos: Photo[] }[] {
  const visitMap = new Map(visits.map((v) => [v.id, v]));
  const buckets = new Map<string, { label: string; sortKey: string; photos: Photo[] }>();

  for (const p of photos) {
    let key: string;
    let label: string;
    let sortKey: string;
    if (p.visit_id && visitMap.has(p.visit_id)) {
      const v = visitMap.get(p.visit_id)!;
      key = `visit:${v.id}`;
      label = `Visit · ${format(parseISO(v.visit_date), "PPPP")}`;
      sortKey = `0_${v.visit_date}`;
    } else if (p.taken_at) {
      const d = p.taken_at.slice(0, 10);
      key = `date:${d}`;
      label = format(parseISO(d), "PPPP");
      sortKey = `1_${d}`;
    } else {
      key = "uncategorized";
      label = "Uncategorized";
      sortKey = "2_";
    }
    const existing = buckets.get(key);
    if (existing) existing.photos.push(p);
    else buckets.set(key, { label, sortKey, photos: [p] });
  }

  return Array.from(buckets.entries())
    .map(([key, { label, photos, sortKey }]) => ({ key, label, photos, sortKey }))
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .map(({ key, label, photos }) => ({ key, label, photos }));
}

function extractStoragePath(url: string, venueId: string): string | null {
  const idx = url.indexOf(`/${BUCKET}/`);
  if (idx === -1) return null;
  return url.substring(idx + BUCKET.length + 2);
}
