"use client";

import { ExternalLink, Phone, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VendorSearchResult } from "@/lib/autopilot-types";

export interface ResultCardProps {
  result: VendorSearchResult;
  selected: boolean;
  onToggle: () => void;
}

function RatingStars({ rating }: { rating?: number }) {
  if (typeof rating !== "number") return null;
  const filled = Math.round(rating);
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Rated ${rating} out of 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < filled
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-stone-300",
          )}
        />
      ))}
    </span>
  );
}

export function ResultCard({ result, selected, onToggle }: ResultCardProps) {
  const photo = result.photos?.[0];
  const description = result.description?.trim();

  return (
    <label
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition",
        selected
          ? "border-stone-900 ring-2 ring-stone-900"
          : "hover:border-stone-400",
      )}
    >
      {/* Photo */}
      <div className="relative aspect-[4/3] w-full bg-stone-100">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={result.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
            No photo
          </div>
        )}
        <div className="absolute right-2 top-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="h-5 w-5 cursor-pointer rounded border-stone-300 bg-white shadow accent-stone-900"
            aria-label={`Add ${result.name} to my vendors`}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight">
              {result.name || "Unnamed vendor"}
            </div>
            {result.address ? (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {result.address}
              </div>
            ) : null}
          </div>
        </div>

        {(typeof result.rating === "number" ||
          typeof result.rating_count === "number") && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RatingStars rating={result.rating} />
            {typeof result.rating === "number" ? (
              <span className="font-medium text-stone-700">
                {result.rating.toFixed(1)}
              </span>
            ) : null}
            {typeof result.rating_count === "number" ? (
              <span>({result.rating_count.toLocaleString()})</span>
            ) : null}
          </div>
        )}

        {description ? (
          <p
            className="line-clamp-2 text-xs text-muted-foreground"
            title={description}
          >
            {description}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-3 pt-2 text-xs">
          {result.website ? (
            <a
              href={result.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-stone-700 hover:text-stone-900"
            >
              <ExternalLink className="h-3 w-3" />
              Website
            </a>
          ) : null}
          {result.phone ? (
            <a
              href={`tel:${result.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-stone-700 hover:text-stone-900"
            >
              <Phone className="h-3 w-3" />
              {result.phone}
            </a>
          ) : null}
        </div>
      </div>
    </label>
  );
}
