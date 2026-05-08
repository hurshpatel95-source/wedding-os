"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ExternalLink, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { VendorAttachmentRow } from "@/lib/vendor-types";

type AttachmentKind = VendorAttachmentRow["kind"];

const BUCKET = "vendor-files";

const KIND_OPTIONS: { value: AttachmentKind; label: string }[] = [
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice" },
  { value: "quote", label: "Quote" },
  { value: "moodboard", label: "Moodboard" },
  { value: "photo", label: "Photo" },
  { value: "other", label: "Other" },
];

const KIND_LABEL: Record<AttachmentKind, string> = {
  contract: "Contracts",
  invoice: "Invoices",
  quote: "Quotes",
  moodboard: "Moodboards",
  photo: "Photos",
  other: "Other",
};

const KIND_ORDER: AttachmentKind[] = [
  "contract",
  "invoice",
  "quote",
  "moodboard",
  "photo",
  "other",
];

type VendorClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export function VendorFilesTab({
  vendorId,
  userId,
  role,
  initialAttachments,
}: {
  vendorId: string;
  userId: string;
  role: "admin" | "couple" | null;
  initialAttachments: VendorAttachmentRow[];
}) {
  const router = useRouter();
  // Couples manage their own vendor files — they're the ones receiving
  // contracts and quote PDFs. Storage policies still scope to workspace.
  const canEdit = role === "admin" || role === "couple";
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [pendingKind, setPendingKind] = useState<AttachmentKind>("contract");
  const [pendingLabel, setPendingLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Pre-fetch signed URLs for all existing attachments so the "Open" link is fast.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const supabase = createClient();
      const entries: [string, string][] = [];
      for (const a of initialAttachments) {
        const path = extractStoragePath(a.url);
        if (!path) continue;
        const { data } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) entries.push([a.id, data.signedUrl]);
      }
      if (!cancelled) setSignedUrls(Object.fromEntries(entries));
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [initialAttachments]);

  const groups = useMemo(() => groupAttachments(initialAttachments), [initialAttachments]);

  const queueFiles = (files: FileList | File[]) => {
    if (!canEdit) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setPendingFiles(list);
    setPendingLabel(list.length === 1 && list[0] ? list[0].name : "");
    setError(null);
  };

  const cancelPending = () => {
    setPendingFiles(null);
    setPendingLabel("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmUpload = async () => {
    if (!pendingFiles || pendingFiles.length === 0) return;
    setUploading(true);
    setError(null);
    setProgress({ done: 0, total: pendingFiles.length });
    const supabase = createClient();
    const sb = supabase as unknown as VendorClient;

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      if (!file) continue;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `${vendorId}/${Date.now()}-${i}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(objectKey, file, { contentType: file.type, upsert: false });

      if (upErr) {
        setError(upErr.message);
        setUploading(false);
        setProgress(null);
        return;
      }

      const { error: insErr } = await sb.from("vendor_attachments").insert({
        vendor_id: vendorId,
        kind: pendingKind,
        url: objectKey,
        label: pendingFiles.length === 1 ? pendingLabel.trim() || file.name : file.name,
        uploaded_by: userId,
      });
      if (insErr) {
        setError(insErr.message);
        setUploading(false);
        setProgress(null);
        return;
      }
      setProgress({ done: i + 1, total: pendingFiles.length });
    }

    setUploading(false);
    setProgress(null);
    setPendingFiles(null);
    setPendingLabel("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  };

  const remove = async (a: VendorAttachmentRow) => {
    if (!canEdit) return;
    if (!confirm(`Delete ${a.label ?? "this file"}?`)) return;
    const supabase = createClient();
    const sb = supabase as unknown as VendorClient;
    const path = extractStoragePath(a.url);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    await sb.from("vendor_attachments").delete().eq("id", a.id);
    router.refresh();
  };

  const openFile = async (a: VendorAttachmentRow) => {
    const cached = signedUrls[a.id];
    if (cached) {
      window.open(cached, "_blank", "noopener,noreferrer");
      return;
    }
    const supabase = createClient();
    const path = extractStoragePath(a.url);
    if (!path) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      setSignedUrls((prev) => ({ ...prev, [a.id]: data.signedUrl }));
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardContent className="space-y-3 py-4">
            {!pendingFiles ? (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files.length > 0) queueFiles(e.dataTransfer.files);
                  }}
                  className={cn(
                    "rounded-md border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground transition-colors",
                    dragOver && "border-foreground/40 bg-secondary/40",
                  )}
                >
                  <Upload className="mx-auto mb-2 h-6 w-6" />
                  Drop a contract, invoice, quote, or moodboard here.
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      Pick files
                    </Button>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && queueFiles(e.target.files)}
                />
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">
                    {pendingFiles.length === 1
                      ? pendingFiles[0]?.name
                      : `${pendingFiles.length} files selected`}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Kind</Label>
                    <Select
                      value={pendingKind}
                      onValueChange={(v) => setPendingKind(v as AttachmentKind)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KIND_OPTIONS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {pendingFiles.length === 1 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="file-label">Label (optional)</Label>
                      <Input
                        id="file-label"
                        value={pendingLabel}
                        onChange={(e) => setPendingLabel(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" onClick={confirmUpload} disabled={uploading}>
                    <Upload className="h-4 w-4" />
                    {uploading
                      ? `Uploading ${progress?.done}/${progress?.total}…`
                      : "Upload"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={cancelPending}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No files yet — drop a contract, invoice, or moodboard.
          </CardContent>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.kind} className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-stone-200 pb-1">
              <h3 className="font-serif text-lg">{KIND_LABEL[g.kind]}</h3>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {g.items.length} file{g.items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-2">
              {g.items.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{a.label ?? a.url}</div>
                      <div className="text-xs text-muted-foreground">
                        Uploaded {format(parseISO(a.created_at), "PP")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openFile(a)}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </Button>
                      {canEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Delete file"
                          onClick={() => remove(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function groupAttachments(
  attachments: VendorAttachmentRow[],
): { kind: AttachmentKind; items: VendorAttachmentRow[] }[] {
  const map = new Map<AttachmentKind, VendorAttachmentRow[]>();
  for (const a of attachments) {
    const arr = map.get(a.kind) ?? [];
    arr.push(a);
    map.set(a.kind, arr);
  }
  return KIND_ORDER.filter((k) => map.has(k)).map((kind) => ({
    kind,
    items: map.get(kind)!,
  }));
}

// Stored attachments may have been written either as the raw object key
// (preferred) or as a signed/public URL. Normalize to the storage path.
function extractStoragePath(stored: string): string | null {
  if (!stored) return null;
  const idx = stored.indexOf(`/${BUCKET}/`);
  if (idx !== -1) return stored.substring(idx + BUCKET.length + 2);
  // Otherwise assume it's already a bucket-relative path.
  return stored;
}
