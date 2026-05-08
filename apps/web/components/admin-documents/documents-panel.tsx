"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  DOCUMENT_KIND_LABEL,
  type DocumentKind,
  type DocumentRow,
} from "@/lib/wave2-types";
import { FileTypeIcon } from "@/components/admin-documents/file-icon";
import { cn } from "@/lib/utils";

const KIND_ORDER: DocumentKind[] = [
  "contract",
  "invoice_received",
  "vendor_proposal",
  "venue_agreement",
  "permit",
  "photo",
  "misc",
];

const PER_FILE_LIMIT_BYTES = 15 * 1024 * 1024;

interface UploadingFile {
  key: string;
  name: string;
  sizeBytes: number;
  progress: number; // 0–100 (we only show 0/50/100 — XHR streaming is overkill here)
  error?: string;
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DocumentsPanel({
  workspaceId,
  initialDocuments,
}: {
  workspaceId: string;
  initialDocuments: DocumentRow[];
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep local list in sync if the parent re-fetches.
  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  const grouped = useMemo(() => {
    const by: Record<DocumentKind, DocumentRow[]> = {
      contract: [],
      invoice_received: [],
      vendor_proposal: [],
      venue_agreement: [],
      permit: [],
      photo: [],
      misc: [],
    };
    for (const d of documents) {
      const k: DocumentKind = (KIND_ORDER as string[]).includes(d.kind)
        ? d.kind
        : "misc";
      by[k].push(d);
    }
    for (const k of KIND_ORDER) {
      by[k].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    return by;
  }, [documents]);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/clients/${workspaceId}/documents`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { documents?: DocumentRow[] };
      if (Array.isArray(data.documents)) setDocuments(data.documents);
    } catch {
      // soft fail — router.refresh() below will catch up the SSR snapshot
    }
    router.refresh();
  }, [workspaceId, router]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setGlobalError(null);
      const accepted: File[] = [];
      let totalBytes = 0;
      for (const f of files) {
        if (f.size > PER_FILE_LIMIT_BYTES) {
          toast.error(
            `"${f.name}" is larger than 15 MB and was skipped.`,
          );
          continue;
        }
        accepted.push(f);
        totalBytes += f.size;
      }
      if (totalBytes > 50 * 1024 * 1024) {
        toast.error("Total upload over 50 MB. Try fewer files at a time.");
        return;
      }
      if (accepted.length === 0) return;

      const slots: UploadingFile[] = accepted.map((f, i) => ({
        key: `${Date.now()}-${i}-${f.name}`,
        name: f.name,
        sizeBytes: f.size,
        progress: 0,
      }));
      setUploading((u) => [...u, ...slots]);

      // Bump each slot to 50% as soon as we kick off (visual feedback only —
      // browsers don't expose real upload progress on fetch without XHR).
      setTimeout(() => {
        setUploading((u) =>
          u.map((row) =>
            slots.find((s) => s.key === row.key) ? { ...row, progress: 50 } : row,
          ),
        );
      }, 50);

      const fd = new FormData();
      for (const f of accepted) fd.append("files", f);

      try {
        const res = await fetch(
          `/api/admin/clients/${workspaceId}/documents`,
          { method: "POST", body: fd },
        );
        const json = (await res.json().catch(() => ({}))) as {
          documents?: DocumentRow[];
          error?: string;
        };
        if (!res.ok) {
          const msg = json.error ?? "Upload failed";
          setGlobalError(msg);
          for (const s of slots) toast.error(`${s.name}: ${msg}`);
          setUploading((u) =>
            u.map((row) =>
              slots.find((s) => s.key === row.key)
                ? { ...row, progress: 100, error: msg }
                : row,
            ),
          );
          // Clear errored rows after a moment.
          setTimeout(() => {
            setUploading((u) =>
              u.filter((row) => !slots.find((s) => s.key === row.key)),
            );
          }, 4000);
          return;
        }
        const inserted = json.documents ?? [];
        setDocuments((prev) => [...inserted, ...prev]);
        for (const d of inserted) toast.success(`Uploaded ${d.name}`);
        setUploading((u) =>
          u.filter((row) => !slots.find((s) => s.key === row.key)),
        );
        // Pull a fresh authoritative list (handles partial server-side
        // dedupe etc.) and refresh the SSR snapshot.
        await refetch();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setGlobalError(msg);
        for (const s of slots) toast.error(`${s.name}: ${msg}`);
        setUploading((u) =>
          u.filter((row) => !slots.find((s) => s.key === row.key)),
        );
      }
    },
    [workspaceId, refetch],
  );

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) void uploadFiles(files);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) void uploadFiles(files);
  };

  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const patchDoc = async (
    id: string,
    body: { kind?: DocumentKind; notes?: string | null },
  ) => {
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/documents/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        document?: DocumentRow;
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Update failed");
        return;
      }
      if (json.document) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === id ? json.document! : d)),
        );
      }
      toast.success("Saved");
    } finally {
      setPendingId(null);
    }
  };

  const deleteDoc = async (doc: DocumentRow) => {
    if (
      !window.confirm(
        `Delete "${doc.name}"? This removes it from storage permanently.`,
      )
    )
      return;
    setPendingId(doc.id);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Delete failed");
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Deleted");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const totalDocs = documents.length;

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <label
        htmlFor="documents-upload-input"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDragEnter={onDragOver}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-white px-8 py-10 text-center transition",
          isDragging
            ? "border-stone-900 bg-stone-50"
            : "border-stone-300 hover:bg-stone-50",
        )}
      >
        <Upload className="h-6 w-6 text-stone-400" />
        <div className="text-sm font-medium text-stone-800">
          Drop files here or click to upload
        </div>
        <div className="text-xs text-stone-500">
          Up to 15 MB per file, 50 MB per upload. Contracts, invoices, vendor
          quotes, photos.
        </div>
        <input
          id="documents-upload-input"
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={onInputChange}
        />
      </label>

      {globalError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {globalError}
        </div>
      )}

      {/* In-flight uploads */}
      {uploading.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-stone-500">
            Uploading
          </div>
          <ul className="space-y-2">
            {uploading.map((u) => (
              <li key={u.key} className="text-xs">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="truncate text-stone-700">{u.name}</span>
                  <span className="tabular-nums text-stone-500">
                    {formatSize(u.sizeBytes)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      u.error ? "bg-rose-400" : "bg-stone-800",
                    )}
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
                {u.error && (
                  <div className="mt-1 text-rose-700">{u.error}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Grouped list */}
      {totalDocs === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-8 py-12 text-center text-sm text-stone-500">
          No documents yet. Drop in contracts, vendor quotes, venue
          agreements, or signed PDFs and they show up here.
        </div>
      ) : (
        <div className="space-y-6">
          {KIND_ORDER.map((k) => {
            const rows = grouped[k];
            if (rows.length === 0) return null;
            return (
              <section key={k} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
                    {DOCUMENT_KIND_LABEL[k]}
                  </h3>
                  <span className="text-xs text-stone-400">
                    {rows.length} {rows.length === 1 ? "file" : "files"}
                  </span>
                </div>
                <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                  {rows.map((doc) => (
                    <DocumentListItem
                      key={doc.id}
                      doc={doc}
                      pending={pendingId === doc.id}
                      onPatch={(body) => patchDoc(doc.id, body)}
                      onDelete={() => deleteDoc(doc)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DocumentListItem({
  doc,
  pending,
  onPatch,
  onDelete,
}: {
  doc: DocumentRow;
  pending: boolean;
  onPatch: (body: { kind?: DocumentKind; notes?: string | null }) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(doc.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);

  // Keep notes in sync if a refetch lands while not editing.
  useEffect(() => {
    if (!editingNotes) setNotes(doc.notes ?? "");
  }, [doc.notes, editingNotes]);

  const commitNotes = () => {
    setEditingNotes(false);
    const trimmed = notes.trim();
    const before = doc.notes ?? "";
    if (trimmed === before) return;
    onPatch({ notes: trimmed.length === 0 ? null : trimmed });
  };

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <FileTypeIcon
          mime={doc.mime_type}
          name={doc.name}
          className="h-5 w-5 flex-shrink-0 text-stone-500"
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-stone-900">
            {doc.name}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-stone-500">
            <span className="tabular-nums">{formatSize(doc.file_size_bytes)}</span>
            <span aria-hidden>·</span>
            <span>Uploaded {formatDate(doc.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={doc.kind}
          disabled={pending}
          onChange={(e) =>
            onPatch({ kind: e.target.value as DocumentKind })
          }
          className="h-8 rounded-md border border-stone-200 bg-white px-2 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-300"
        >
          {KIND_ORDER.map((k) => (
            <option key={k} value={k}>
              {DOCUMENT_KIND_LABEL[k]}
            </option>
          ))}
        </select>

        {editingNotes ? (
          <input
            value={notes}
            autoFocus
            onChange={(e) => setNotes(e.target.value)}
            onBlur={commitNotes}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitNotes();
              } else if (e.key === "Escape") {
                setNotes(doc.notes ?? "");
                setEditingNotes(false);
              }
            }}
            placeholder="Add a note"
            className="h-8 w-44 rounded-md border border-stone-300 bg-white px-2 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingNotes(true)}
            className={cn(
              "h-8 max-w-[12rem] truncate rounded-md border border-transparent px-2 text-left text-xs hover:border-stone-200 hover:bg-stone-50",
              doc.notes ? "text-stone-700" : "text-stone-400 italic",
            )}
            title={doc.notes ?? "Add a note"}
          >
            {doc.notes ?? "Add a note"}
          </button>
        )}

        <a
          href={`/api/admin/documents/${doc.id}/download`}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
          title="Download"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download</span>
        </a>

        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
          title="Delete"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </li>
  );
}

