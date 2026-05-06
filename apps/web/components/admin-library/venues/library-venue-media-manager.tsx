"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MediaItem {
  id: string;
  kind: "photo" | "video";
  storage_path: string | null;
  signed_url: string | null;
  sort_order: number;
  alt: string | null;
}

export function LibraryVenueMediaManager({
  venueId,
  initialMedia,
}: {
  venueId: string;
  initialMedia: MediaItem[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[]>(initialMedia);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFromServer = () => {
    router.refresh();
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setError(null);
    setProgress({ done: 0, total: list.length });

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      if (!file) continue;
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/admin/library/venues/${venueId}/media`,
        { method: "POST", body: fd },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `Upload failed: ${file.name}`);
        break;
      }
      const j = (await res.json()) as { item: MediaItem };
      setItems((prev) => [...prev, j.item]);
      setProgress({ done: i + 1, total: list.length });
    }

    setUploading(false);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    refreshFromServer();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  };

  const removeItem = async (item: MediaItem) => {
    if (!confirm("Delete this media?")) return;
    const res = await fetch(
      `/api/admin/library/venues/${venueId}/media/${item.id}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Delete failed");
      return;
    }
    setItems((prev) => prev.filter((m) => m.id !== item.id));
    refreshFromServer();
  };

  const moveItem = async (item: MediaItem, dir: -1 | 1) => {
    const idx = items.findIndex((m) => m.id === item.id);
    if (idx === -1) return;
    const swap = items[idx + dir];
    if (!swap) return;
    // Optimistic swap
    const next = [...items];
    next[idx] = swap;
    next[idx + dir] = item;
    // Reassign sort_order based on new index
    const reordered = next.map((m, i) => ({ ...m, sort_order: i }));
    setItems(reordered);

    // Persist both rows
    await Promise.all([
      fetch(`/api/admin/library/venues/${venueId}/media/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sort_order: idx + dir }),
      }),
      fetch(`/api/admin/library/venues/${venueId}/media/${swap.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sort_order: idx }),
      }),
    ]);
    refreshFromServer();
  };

  const setAsCover = async (item: MediaItem) => {
    // Cover = sort_order 0. Bump everyone else.
    const reordered = [
      { ...item, sort_order: 0 },
      ...items.filter((m) => m.id !== item.id).map((m, i) => ({
        ...m,
        sort_order: i + 1,
      })),
    ];
    setItems(reordered);

    // Persist all rows. Cheap — list is small.
    await Promise.all(
      reordered.map((m) =>
        fetch(`/api/admin/library/venues/${venueId}/media/${m.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sort_order: m.sort_order }),
        }),
      ),
    );
    refreshFromServer();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-base">Photos &amp; videos</h3>
              <p className="text-xs text-stone-500">
                Drop files here. First photo (sort_order 0) is the cover.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progress ? `Uploading ${progress.done}/${progress.total}…` : "Uploading…"}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Pick files
                </>
              )}
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/quicktime,video/mp4,video/webm"
              className="hidden"
              onChange={(e) =>
                e.target.files && uploadFiles(e.target.files)
              }
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
            Drop photos / videos here to add them to the library record.
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No media yet. Drop some files above to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {items.map((m, i) => (
            <div
              key={m.id}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
            >
              {m.kind === "video" ? (
                m.signed_url ? (
                  <video
                    src={m.signed_url}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
                    Video
                  </div>
                )
              ) : m.signed_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.signed_url}
                  alt={m.alt ?? ""}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
                  Photo
                </div>
              )}

              {i === 0 && (
                <div className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-stone-900/85 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">
                  Cover
                </div>
              )}
              {m.kind === "video" && (
                <div className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">
                  Video
                </div>
              )}

              <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {i !== 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Set as cover"
                    onClick={() => setAsCover(m)}
                    title="Set as cover"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => moveItem(m, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Move down"
                  disabled={i === items.length - 1}
                  onClick={() => moveItem(m, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Delete"
                  onClick={() => removeItem(m)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
