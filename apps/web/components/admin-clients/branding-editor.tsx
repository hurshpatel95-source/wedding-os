"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InitialBranding {
  accent_hex: string;
  planner_display_name: string;
  logo_storage_path: string | null;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function BrandingEditor({
  workspaceId,
  initial,
  logoSignedUrl,
}: {
  workspaceId: string;
  initial: InitialBranding;
  logoSignedUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [accent, setAccent] = useState(initial.accent_hex);
  const [displayName, setDisplayName] = useState(initial.planner_display_name);
  const [logoPath, setLogoPath] = useState<string | null>(
    initial.logo_storage_path,
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(logoSignedUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const accentValid = HEX_RE.test(accent);
  const dirty =
    accent !== initial.accent_hex ||
    (displayName ?? "") !== (initial.planner_display_name ?? "") ||
    pendingFile !== null;

  const handleFilePick = (file: File | null) => {
    if (!file) {
      setPendingFile(null);
      setPendingPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file (PNG, JPG, SVG, etc).");
      return;
    }
    setError(null);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  };

  const saveFields = async () => {
    if (!accentValid) {
      setError("Accent must be a 6-digit hex color, e.g. #9d174d.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${workspaceId}/branding`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accent_hex: accent,
            planner_display_name:
              displayName.trim().length > 0 ? displayName.trim() : null,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }

      // Then upload logo (if any) — separate request because it's multipart.
      if (pendingFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", pendingFile);
        const upRes = await fetch(
          `/api/admin/clients/${workspaceId}/branding/logo`,
          { method: "POST", body: fd },
        );
        if (!upRes.ok) {
          const body = (await upRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Logo upload failed (${upRes.status})`);
        }
        const data = (await upRes.json()) as {
          logo_storage_path: string;
          signed_url: string | null;
        };
        setLogoPath(data.logo_storage_path);
        setLogoUrl(data.signed_url);
        setPendingFile(null);
        if (pendingPreview) URL.revokeObjectURL(pendingPreview);
        setPendingPreview(null);
        setUploading(false);
      }

      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!logoPath) return;
    setRemovingLogo(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${workspaceId}/branding/logo`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Remove failed (${res.status})`);
      }
      setLogoPath(null);
      setLogoUrl(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemovingLogo(false);
    }
  };

  const previewUrl = pendingPreview ?? logoUrl;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Form */}
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-serif text-xl font-light">Identity</h2>
          <p className="mb-5 text-sm text-stone-500">
            Color + name shown across the couple's planning shell.
          </p>

          <div className="space-y-5">
            <div>
              <Label htmlFor="accent" className="mb-1.5 block">
                Accent color
              </Label>
              <div className="flex items-center gap-3">
                <input
                  id="accent-picker"
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-md border border-stone-200"
                  aria-label="Accent color picker"
                />
                <Input
                  id="accent"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  placeholder="#9d174d"
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              {!accentValid && (
                <p className="mt-1.5 text-xs text-rose-600">
                  Use a 6-digit hex like #9d174d.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="display-name" className="mb-1.5 block">
                Planner display name
              </Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Astha Weddings"
              />
              <p className="mt-1.5 text-xs text-stone-500">
                Couple sees this in their shell instead of your raw studio name.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-serif text-xl font-light">Logo</h2>
          <p className="mb-5 text-sm text-stone-500">
            PNG or SVG, max ~1MB. Stored in the private library-media bucket.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Logo preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="px-3 text-center text-xs text-stone-400">
                  No logo yet
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  handleFilePick(e.target.files?.[0] ?? null)
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                className="gap-1.5"
              >
                <UploadCloud className="h-4 w-4" />
                {pendingFile ? "Choose different file" : "Choose logo file"}
              </Button>

              {pendingFile && (
                <p className="text-xs text-stone-500">
                  <span className="font-medium text-stone-700">
                    {pendingFile.name}
                  </span>
                  {" "}
                  {(pendingFile.size / 1024).toFixed(0)} KB — uploads on save.
                </p>
              )}

              {logoPath && !pendingFile && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={removeLogo}
                  disabled={removingLogo}
                  className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  {removingLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Remove logo
                </Button>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={saveFields}
            disabled={saving || !accentValid || !dirty}
            className="gap-1.5"
          >
            {(saving || uploading) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {uploading ? "Uploading…" : saving ? "Saving…" : "Save branding"}
          </Button>
          {savedFlash && (
            <span className="text-xs text-emerald-700">Saved.</span>
          )}
        </div>
      </div>

      {/* Live preview */}
      <aside className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
          Preview
        </div>
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{
              background:
                accentValid && accent
                  ? `linear-gradient(90deg, ${accent}, ${accent}cc)`
                  : "#9d174d",
            }}
          >
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/90 ring-1 ring-white/40">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="font-serif text-lg text-stone-700">
                  {(displayName || "S").trim().charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="leading-tight text-white">
              <div className="font-serif text-base">
                {displayName || "Studio"}
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/80">
                Planning portal
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white transition"
              style={{ background: accentValid ? accent : "#9d174d" }}
            >
              Sample button
            </button>
            <div className="text-xs text-stone-500">
              This is roughly how the couple sees the accent in their shell.
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
