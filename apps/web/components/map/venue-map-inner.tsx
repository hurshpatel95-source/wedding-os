"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/venue-status";
import type { VenuePoint } from "./venue-map";

// Status → marker color (hex). Custom DivIcon so we don't need to ship sprite assets.
const STATUS_COLOR: Record<VenuePoint["status"], string> = {
  shortlisted: "#a8a29e", // stone-400
  visited: "#1f2937", // stone-800
  quoted: "#d97706", // amber-600
  decided: "#059669", // emerald-600
  passed: "#9ca3af", // gray-400
};

function pinIcon(color: string, isLead: boolean) {
  // Simple SVG pin, scales nicely on retina, no external assets.
  const svg = `
    <svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 1c-8.284 0-15 6.716-15 15 0 11 15 27 15 27s15-16 15-27c0-8.284-6.716-15-15-15z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="17" cy="16" r="6" fill="white"/>
      ${isLead ? '<circle cx="17" cy="16" r="2.5" fill="#be123c"/>' : ""}
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "venue-pin",
    iconSize: [34, 44],
    iconAnchor: [17, 44],
    popupAnchor: [0, -42],
  });
}

function FitBounds({ points }: { points: VenuePoint[] }) {
  const map = useMap();
  // Run-once: fit bounds to all markers on first render
  useMemoFitBounds(map, points);
  return null;
}

function useMemoFitBounds(map: L.Map, points: VenuePoint[]) {
  useMemo(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.geo_lat, p.geo_lng] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }, [map, points]);
}

export function VenueMapInner({ venues }: { venues: VenuePoint[] }) {
  // Center on rough midpoint of the cluster
  const center: [number, number] = useMemo(() => {
    if (venues.length === 0) return [41.4, 2.0];
    const lat = venues.reduce((s, v) => s + v.geo_lat, 0) / venues.length;
    const lng = venues.reduce((s, v) => s + v.geo_lng, 0) / venues.length;
    return [lat, lng];
  }, [venues]);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <MapContainer
        center={center}
        zoom={10}
        style={{ height: "640px", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={venues} />
        {venues.map((v) => (
          <Marker
            key={v.id}
            position={[v.geo_lat, v.geo_lng]}
            icon={pinIcon(STATUS_COLOR[v.status], v.is_lead_pick)}
          >
            <Popup minWidth={220}>
              <div className="space-y-2 font-sans">
                {v.hero_photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.hero_photo_url}
                    alt={v.name}
                    className="h-24 w-full rounded object-cover"
                  />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-serif text-base font-medium leading-tight">
                      {v.name}
                    </div>
                    <div className="text-[11px] text-stone-500">{v.address ?? ""}</div>
                  </div>
                  <Badge variant={STATUS_VARIANT[v.status]} className="text-[10px]">
                    {STATUS_LABEL[v.status]}
                  </Badge>
                </div>
                <div className="text-[11px] text-stone-600">
                  Cap {v.capacity_min ?? "?"}–{v.capacity_max ?? "?"}
                  {(v.event_roles ?? []).length > 0 && (
                    <> · {(v.event_roles ?? []).join(", ")}</>
                  )}
                </div>
                {v.is_lead_pick && (
                  <Badge variant="warning" className="text-[10px]">
                    Lead pick
                  </Badge>
                )}
                <div className="pt-1">
                  <Link
                    href={`/venues/${v.id}`}
                    className="text-xs font-medium text-rose-700 underline"
                  >
                    Open detail →
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
