"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Database } from "@wedding-os/db";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

export function OverviewTab({ venue }: { venue: Venue }) {
  const facts: { label: string; value: string }[] = [
    {
      label: "Capacity",
      value:
        venue.capacity_min || venue.capacity_max
          ? `${venue.capacity_min ?? "?"}–${venue.capacity_max ?? "?"} guests`
          : "—",
    },
    { label: "Indoor / Outdoor", value: venue.indoor_outdoor ?? "—" },
    { label: "In-house catering", value: venue.in_house_catering ? "Yes" : "No" },
    { label: "On-site accommodation", value: venue.has_accommodation ? "Yes" : "No" },
  ];

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapsQuery = encodeURIComponent(`${venue.name} ${venue.address ?? ""}`.trim());

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Facts</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {venue.planner_notes && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Planner notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{venue.planner_notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <div className="text-muted-foreground">Name</div>
              <div className="font-medium">{venue.contact_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Email</div>
              <div className="font-medium">
                {venue.contact_email ? (
                  <a className="hover:underline" href={`mailto:${venue.contact_email}`}>
                    {venue.contact_email}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Phone</div>
              <div className="font-medium">{venue.contact_phone ?? "—"}</div>
            </div>
          </CardContent>
        </Card>

        {venue.address && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Map</CardTitle>
            </CardHeader>
            <CardContent>
              {mapsKey ? (
                <iframe
                  className="h-56 w-full rounded-md border"
                  loading="lazy"
                  title={`${venue.name} map`}
                  src={`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${mapsQuery}`}
                />
              ) : (
                <a
                  className="text-sm text-muted-foreground hover:underline"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                >
                  Open in Google Maps →
                </a>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
