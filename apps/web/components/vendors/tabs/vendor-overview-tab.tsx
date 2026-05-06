"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Instagram, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  VENDOR_STATUSES,
  VENDOR_STATUS_LABEL,
} from "@/lib/vendor-categories";
import type { VendorRow, VendorStatus } from "@/lib/vendor-types";

// Linear progression of statuses (excluding "declined" which is a side-branch)
const STATUS_PROGRESSION: VendorStatus[] = [
  "researching",
  "rfp_sent",
  "quoted",
  "shortlisted",
  "booked",
  "completed",
];

type VendorClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export function VendorOverviewTab({
  vendor,
  role,
}: {
  vendor: VendorRow;
  role: "admin" | "couple" | null;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";
  const [pendingStatus, setPendingStatus] = useState<VendorStatus | null>(null);
  const [pendingRating, setPendingRating] = useState<number | null>(null);

  const advanceStatus = async (next: VendorStatus) => {
    if (!isAdmin) return;
    setPendingStatus(next);
    const supabase = createClient();
    const sb = supabase as unknown as VendorClient;
    const { error } = await sb
      .from("vendors")
      .update({ status: next })
      .eq("id", vendor.id);
    setPendingStatus(null);
    if (!error) router.refresh();
  };

  const setRating = async (n: number) => {
    if (!isAdmin) return;
    setPendingRating(n);
    const supabase = createClient();
    const sb = supabase as unknown as VendorClient;
    const next = vendor.planner_rating === n ? null : n;
    const { error } = await sb
      .from("vendors")
      .update({ planner_rating: next })
      .eq("id", vendor.id);
    setPendingRating(null);
    if (!error) router.refresh();
  };

  const currentIndex = STATUS_PROGRESSION.indexOf(vendor.status);
  const isDeclined = vendor.status === "declined";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {vendor.notes ? (
              <p className="whitespace-pre-wrap text-sm">{vendor.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No notes yet. {isAdmin && "Use the Edit vendor button above to add some."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Status timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {isDeclined ? (
              <p className="text-sm text-muted-foreground">
                This vendor is marked declined. Use the Edit vendor button above to revive.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_PROGRESSION.map((s, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isPast = idx < currentIndex;
                  const isFuture = idx > currentIndex;
                  const canAdvance = isAdmin && isFuture;
                  const isPending = pendingStatus === s;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!canAdvance || isPending}
                        onClick={() => advanceStatus(s)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          isCurrent && "border-foreground bg-foreground text-background",
                          isPast && "border-emerald-300 bg-emerald-50 text-emerald-900",
                          isFuture &&
                            !canAdvance &&
                            "border-stone-200 bg-stone-50 text-stone-400",
                          canAdvance &&
                            "border-stone-300 bg-background text-stone-600 hover:border-foreground hover:text-foreground",
                          isPending && "opacity-60",
                        )}
                      >
                        {VENDOR_STATUS_LABEL[s]}
                      </button>
                      {idx < STATUS_PROGRESSION.length - 1 && (
                        <span className="text-stone-300">→</span>
                      )}
                    </div>
                  );
                })}
                {isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:text-destructive"
                    onClick={() => advanceStatus("declined")}
                    disabled={pendingStatus !== null}
                  >
                    Mark declined
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <div className="text-muted-foreground">Name</div>
              <div className="font-medium">{vendor.contact_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Email</div>
              <div className="font-medium">
                {vendor.contact_email ? (
                  <a className="hover:underline" href={`mailto:${vendor.contact_email}`}>
                    {vendor.contact_email}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Phone</div>
              <div className="font-medium">
                {vendor.contact_phone ? (
                  <a className="hover:underline" href={`tel:${vendor.contact_phone}`}>
                    {vendor.contact_phone}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Website</div>
              <div className="font-medium">
                {vendor.website ? (
                  <a
                    className="inline-flex items-center gap-1 hover:underline"
                    href={vendor.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {prettyHost(vendor.website)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Instagram</div>
              <div className="font-medium">
                {vendor.instagram ? (
                  <a
                    className="inline-flex items-center gap-1 hover:underline"
                    href={instagramUrl(vendor.instagram)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Instagram className="h-3 w-3" />
                    {prettyInstagram(vendor.instagram)}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Visibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Couple-visible</span>
              <Badge variant={vendor.is_couple_visible ? "success" : "muted"}>
                {vendor.is_couple_visible ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Include in pricing total</span>
              <Badge variant={vendor.include_in_pricing ? "success" : "muted"}>
                {vendor.include_in_pricing ? "Yes" : "No"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Planner rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = (vendor.planner_rating ?? 0) >= n;
                const isPending = pendingRating === n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={!isAdmin || pendingRating !== null}
                    onClick={() => setRating(n)}
                    className={cn(
                      "rounded p-1 transition-colors",
                      isAdmin && "hover:bg-secondary",
                      !isAdmin && "cursor-default",
                      isPending && "opacity-60",
                    )}
                    aria-label={`Set rating to ${n}`}
                  >
                    <Star
                      className={cn(
                        "h-5 w-5",
                        filled ? "fill-amber-400 text-amber-500" : "text-stone-300",
                      )}
                    />
                  </button>
                );
              })}
              {vendor.planner_rating != null && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {vendor.planner_rating}/5
                </span>
              )}
            </div>
            {!isAdmin && vendor.planner_rating == null && (
              <p className="mt-2 text-xs text-muted-foreground">Not yet rated.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function prettyHost(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(
      /^www\./,
      "",
    );
  } catch {
    return url;
  }
}

function instagramUrl(handle: string): string {
  if (handle.startsWith("http")) return handle;
  const cleaned = handle.replace(/^@/, "").replace(/^instagram\.com\//, "");
  return `https://instagram.com/${cleaned}`;
}

function prettyInstagram(handle: string): string {
  if (handle.startsWith("http")) {
    try {
      const u = new URL(handle);
      return `@${u.pathname.replace(/^\//, "").replace(/\/$/, "")}`;
    } catch {
      return handle;
    }
  }
  return handle.startsWith("@") ? handle : `@${handle}`;
}
