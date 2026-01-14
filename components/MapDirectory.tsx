"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { GeoJSONSource, Map, MapMouseEvent } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import listingsData from "../data/listings.json";

type Category = "cafe" | "hotel" | "mall" | "park" | "groomer" | "vet" | "supplies";

type Listing = {
  id: string;
  name: string;
  category: Category;
  address: string;
  lat: number;
  lng: number;

  website?: string;
  phone?: string;
  hours?: string;
  priceRange?: string;
  petPolicy?: string;

  note?: string;
  images?: string[];

  rating?: number | null;
  userRatingCount?: number | null;

  verificationStatus?: "verified" | "needs_check";
  verifiedBy?: string;
};

const CATEGORY_LABELS: Record<Category, string> = {
  cafe: "☕ Cafes",
  hotel: "🏨 Hotels",
  mall: "🛍️ Malls",
  park: "🌳 Parks",
  groomer: "✂️ Groomers",
  vet: "🩺 Vets",
  supplies: "🦴 Pet Supplies",
};

const CATEGORY_EMOJI: Record<Category, string> = {
  cafe: "☕",
  hotel: "🏨",
  mall: "🛍️",
  park: "🌳",
  groomer: "✂️",
  vet: "🩺",
  supplies: "🦴",
};

const SAMPLE_LISTINGS = listingsData as Listing[];

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

type ListingWithDistance = Listing & { distanceKm: number | null };

/**
 * Category palette (requested):
 * - cafes: pastel pink
 * - malls: pastel blue
 * - hotels: pastel yellow
 * - pet supplies: pastel orange
 * - parks: pastel green
 * - vets: black
 * - cluster: pink
 */
const CAT_COLORS = {
  cafe: { bg: "bg-pink-200", ring: "ring-pink-300", text: "text-black", hex: "#FBCFE8" }, // pink-200
  mall: { bg: "bg-blue-200", ring: "ring-blue-300", text: "text-black", hex: "#BFDBFE" }, // blue-200
  hotel: { bg: "bg-yellow-200", ring: "ring-yellow-300", text: "text-black", hex: "#FEF08A" }, // yellow-200
  supplies: { bg: "bg-orange-200", ring: "ring-orange-300", text: "text-black", hex: "#FED7AA" }, // orange-200
  park: { bg: "bg-green-200", ring: "ring-green-300", text: "text-black", hex: "#BBF7D0" }, // green-200
  vet: { bg: "bg-black", ring: "ring-black/40", text: "text-white", hex: "#111111" }, // black-ish
  groomer: { bg: "bg-fuchsia-200", ring: "ring-fuchsia-300", text: "text-black", hex: "#F5D0FE" }, // (not specified; kept fun/pinkish)
} satisfies Record<Category, { bg: string; ring: string; text: string; hex: string }>;

function catButtonClass(cat: Category, on: boolean) {
  const c = CAT_COLORS[cat];
  if (on) {
    return [
      "rounded-full px-3 py-1.5 text-sm border transition ring-2",
      c.bg,
      c.text,
      c.ring,
      "border-black/10",
      "hover:opacity-90",
    ].join(" ");
  }
  return [
    "rounded-full px-3 py-1.5 text-sm border transition",
    "bg-white",
    "hover:bg-black/5",
    "border-black/15",
  ].join(" ");
}

function catPillClass(cat: Category) {
  const c = CAT_COLORS[cat];
  return ["inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1", c.bg, c.text, c.ring].join(
    " "
  );
}

export default function MapDirectory() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(
    new Set(Object.keys(CATEGORY_LABELS) as Category[])
  );
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [geoError, setGeoError] = useState<string | null>(null);

  const filtered: ListingWithDistance[] = useMemo(() => {
    const base = SAMPLE_LISTINGS.filter((l) => selectedCategories.has(l.category));
    if (!userPos) return base.map((l) => ({ ...l, distanceKm: null }));

    return base
      .map((l) => ({ ...l, distanceKm: haversineKm(userPos, { lat: l.lat, lng: l.lng }) }))
      .filter((l) => (l.distanceKm ?? 0) <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [selectedCategories, userPos, radiusKm]);

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: filtered.map((l) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] as [number, number] },
        properties: {
          id: l.id,
          name: l.name,
          category: l.category,
          address: l.address,
          note: l.note ?? "",
          emoji: CATEGORY_EMOJI[l.category],
          verificationStatus: l.verificationStatus ?? "",
          rating: l.rating ?? "",
          userRatingCount: l.userRatingCount ?? "",
        },
      })),
    };
  }, [filtered]);

  useEffect(() => {
    if (!token) return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [103.8198, 1.3521],
      zoom: 10.8,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("listings", {
        type: "geojson",
        data: geojson as any,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // ✅ Cluster circles (PINK)
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "listings",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": ["step", ["get", "point_count"], 16, 20, 22, 50, 28, 100, 34],
          "circle-color": "#EC4899", // pink-500
          "circle-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "listings",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // ✅ Unclustered pins: category-colored circles
      map.addLayer({
        id: "unclustered-circle",
        type: "circle",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 8,
          "circle-color": [
            "match",
            ["get", "category"],
            "cafe",
            CAT_COLORS.cafe.hex,
            "mall",
            CAT_COLORS.mall.hex,
            "hotel",
            CAT_COLORS.hotel.hex,
            "supplies",
            CAT_COLORS.supplies.hex,
            "park",
            CAT_COLORS.park.hex,
            "vet",
            CAT_COLORS.vet.hex,
            "groomer",
            CAT_COLORS.groomer.hex,
            "#111111",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Emoji label
      map.addLayer({
        id: "unclustered-label",
        type: "symbol",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "emoji"],
          "text-size": 12,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#111111",
        },
      });

      map.on("click", "clusters", (e: MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        if (!features.length) return;

        const clusterId = features[0].properties?.cluster_id as number | undefined;
        if (clusterId === undefined) return;

        const source = map.getSource("listings") as GeoJSONSource;
        (source as any).getClusterExpansionZoom(clusterId, (err: unknown, zoom: number) => {
          if (err) return;
          const coords = (features[0].geometry as any).coordinates as [number, number];
          map.easeTo({ center: coords, zoom: zoom + 1 });
        });
      });

      map.on("click", "unclustered-circle", (e: any) => {
        const f = e.features?.[0];
        if (!f) return;

        const coords = (f.geometry.coordinates as [number, number]).slice() as [number, number];
        const p = f.properties as any;

        const cat = p.category as Category;
        const status = (p.verificationStatus || "").toString();
        const rating = p.rating ? `${p.rating}⭐` : "";
        const reviews = p.userRatingCount ? `${p.userRatingCount} reviews` : "";

        const catColor =
          cat === "cafe"
            ? CAT_COLORS.cafe.hex
            : cat === "mall"
            ? CAT_COLORS.mall.hex
            : cat === "hotel"
            ? CAT_COLORS.hotel.hex
            : cat === "supplies"
            ? CAT_COLORS.supplies.hex
            : cat === "park"
            ? CAT_COLORS.park.hex
            : cat === "vet"
            ? CAT_COLORS.vet.hex
            : CAT_COLORS.groomer.hex;

        const catTextColor = cat === "vet" ? "#ffffff" : "#111111";

        new mapboxgl.Popup({ offset: 18 })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family: ui-sans-serif;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="font-weight:800;">${p.name}</span>
                <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${catColor};color:${catTextColor};border:1px solid rgba(0,0,0,.08);">
                  ${CATEGORY_LABELS[cat] ?? ""}
                </span>
              </div>
              <div style="font-size:12px;opacity:.85;margin-bottom:6px;">${p.address}</div>
              ${
                rating || reviews
                  ? `<div style="font-size:12px;opacity:.85;margin-top:6px;">${[rating, reviews]
                      .filter(Boolean)
                      .join(" • ")}</div>`
                  : ""
              }
              ${
                status
                  ? `<div style="font-size:12px;opacity:.85;margin-top:6px;"><b>${status}</b></div>`
                  : ""
              }
              <div style="margin-top:10px;">
                <a href="/listing/${p.id}" style="font-size:12px;text-decoration:underline;color:#EC4899;font-weight:700;">
                  Open details →
                </a>
              </div>
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "clusters", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "clusters", () => (map.getCanvas().style.cursor = ""));
      map.on("mouseenter", "unclustered-circle", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "unclustered-circle", () => (map.getCanvas().style.cursor = ""));
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]); // init once

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource("listings") as GeoJSONSource | undefined;
    if (source) source.setData(geojson as any);
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;

    map.flyTo({ center: [userPos.lng, userPos.lat], zoom: 13 });

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    // Fun pink-ish blue dot? (kept blue for location clarity; tell me if you want pink)
    const el = document.createElement("div");
    el.style.width = "14px";
    el.style.height = "14px";
    el.style.borderRadius = "50%";
    el.style.background = "#2563eb"; // blue-600
    el.style.border = "3px solid white";
    el.style.boxShadow = "0 0 0 6px rgba(37, 99, 235, 0.25)";

    userMarkerRef.current = new mapboxgl.Marker(el).setLngLat([userPos.lng, userPos.lat]).addTo(map);
  }, [userPos]);

  function toggleCategory(cat: Category) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  function useMyLocation() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Your browser doesn’t support location.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGeoError(err.message || "Could not get location."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  if (!token) {
    return (
      <div className="rounded-2xl border p-4 bg-white">
        Add <code className="px-1 py-0.5 bg-black/5 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{" "}
        <code className="px-1 py-0.5 bg-black/5 rounded">.env</code> or{" "}
        <code className="px-1 py-0.5 bg-black/5 rounded">.env.local</code>, then restart{" "}
        <code className="px-1 py-0.5 bg-black/5 rounded">npm run dev</code>.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
      {/* LEFT: MAP */}
      <div className="rounded-2xl border bg-white overflow-hidden shadow-sm ring-1 ring-pink-200">
        <div ref={mapContainerRef} className="h-[72vh] lg:h-[82vh] w-full" />
      </div>

      {/* RIGHT: FILTERS + RESULTS */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-pink-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">
              Find dog-friendly places <span className="text-pink-500">🐾</span>
            </div>
            <div className="text-sm opacity-75">Use location, filter categories, explore.</div>
          </div>

          {/* Pink theme primary button */}
          <button
            onClick={useMyLocation}
            className="rounded-xl px-3 py-2 text-sm font-extrabold bg-pink-500 text-white hover:bg-pink-600 shadow-sm"
          >
            Use my location
          </button>
        </div>

        {geoError ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">{geoError}</div>
        ) : null}

        <div className="mt-4">
          <div className="font-semibold mb-2">Categories</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => {
              const on = selectedCategories.has(cat);
              return (
                <button key={cat} onClick={() => toggleCategory(cat)} className={catButtonClass(cat, on)}>
                  {CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Radius</div>
            <div className="text-sm opacity-80">{userPos ? `${radiusKm} km` : "Set location"}</div>
          </div>
          <input
            type="range"
            min={1}
            max={15}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            disabled={!userPos}
            className="mt-2 w-full accent-pink-500"
          />
        </div>

        <div className="mt-5">
          <div className="font-semibold mb-2">Results ({filtered.length})</div>
          <div className="space-y-2 max-h-[55vh] overflow-auto pr-1">
            {filtered.map((l) => (
              <button
                key={l.id}
                onClick={() => window.location.assign(`/listing/${l.id}`)}
                className="w-full text-left rounded-2xl border p-3 hover:bg-pink-50 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold">{l.name}</div>

                  <div className="flex items-center gap-2">
                    {/* category pill */}
                    <span className={catPillClass(l.category)}>{CATEGORY_LABELS[l.category]}</span>

                    {l.verificationStatus ? (
                      <span
                        className={[
                          "text-[11px] px-2 py-1 rounded-full border whitespace-nowrap font-semibold",
                          l.verificationStatus === "verified"
                            ? "bg-pink-500 text-white border-pink-500"
                            : "bg-white",
                        ].join(" ")}
                      >
                        {l.verificationStatus}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="text-sm opacity-75">{l.address}</div>

                <div className="text-xs opacity-70 mt-1">
                  {l.distanceKm != null ? `📍 ${l.distanceKm.toFixed(1)} km` : ""}
                  {typeof l.rating === "number" ? ` • ${l.rating}⭐` : ""}
                  {typeof l.userRatingCount === "number" ? ` • ${l.userRatingCount} reviews` : ""}
                </div>
              </button>
            ))}

            {filtered.length === 0 ? (
              <div className="text-sm opacity-70 rounded-xl border p-3">
                No results. Select more categories or increase radius.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
