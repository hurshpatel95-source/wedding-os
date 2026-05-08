"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Star, X } from "lucide-react";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export function TestimonialSubmissionForm({
  token,
  coupleNames,
}: {
  token: string;
  coupleNames: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [quote, setQuote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please pick an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`Photo too large (max ${MAX_PHOTO_BYTES / 1024 / 1024}MB).`);
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));

    // Upload immediately so submit is fast.
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/testimonial/${token}/photo`, {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        storage_path?: string;
        error?: string;
      };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Couldn't upload your photo.");
        setPhotoFile(null);
        setPhotoPreview(null);
      } else if (json.storage_path) {
        setStoragePath(json.storage_path);
      }
    } catch (err) {
      setError((err as Error).message);
      setPhotoFile(null);
      setPhotoPreview(null);
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setStoragePath(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || photoUploading) return;
    setError(null);

    const trimmed = quote.trim();
    if (rating < 1) {
      setError("Pick a rating from 1 to 5 stars.");
      return;
    }
    if (trimmed.length < 10) {
      setError("Please share at least 10 characters.");
      return;
    }
    if (trimmed.length > 2000) {
      setError("Please keep it under 2000 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/testimonial/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quote: trimmed,
          rating,
          photo_storage_path: storagePath,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Couldn't submit your testimonial.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h3 className="mt-3 font-serif text-2xl font-light text-stone-900">
          Thank you{coupleNames ? `, ${coupleNames}` : ""}.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-stone-700">
          Your words are saved. The planner will review and publish them shortly.
        </p>
      </div>
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-stone-500">
          How was your experience?
        </label>
        <div className="mt-2 flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHoverRating(i)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(i)}
              className="transition-transform hover:scale-110"
              aria-label={`${i} star${i === 1 ? "" : "s"}`}
            >
              <Star
                className={`h-9 w-9 ${
                  i <= displayRating
                    ? "fill-amber-400 text-amber-400"
                    : "fill-stone-200 text-stone-200"
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-3 text-sm text-stone-500">
              {rating} of 5
            </span>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="quote-text" className="text-[10px] uppercase tracking-wider text-stone-500">
          A few words
        </label>
        <textarea
          id="quote-text"
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          rows={6}
          minLength={10}
          maxLength={2000}
          required
          placeholder="What stood out about working together? Anything you'd want a future couple to know?"
          className="mt-2 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm leading-relaxed focus:border-stone-900 focus:outline-none"
        />
        <div className="mt-1 text-right text-[11px] text-stone-400">
          {quote.length}/2000
        </div>
      </div>

      <div>
        <span className="text-[10px] uppercase tracking-wider text-stone-500">
          Photo (optional)
        </span>
        {photoPreview ? (
          <div className="mt-2 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Selected photo preview"
              className="h-24 w-24 rounded-2xl object-cover"
            />
            <div className="flex flex-col gap-1.5">
              {photoUploading ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Uploaded
                </span>
              )}
              <button
                type="button"
                onClick={removePhoto}
                disabled={photoUploading || submitting}
                className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-rose-700 disabled:opacity-50"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        ) : (
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400">
            <ImagePlus className="h-3.5 w-3.5" />
            Add a photo
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
              disabled={photoUploading || submitting}
            />
          </label>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={submitting || photoUploading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Submit testimonial
        </button>
      </div>
    </form>
  );
}
