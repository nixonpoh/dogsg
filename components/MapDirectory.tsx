"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { GeoJSONSource, Map, MapMouseEvent } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Category = "cafe" | "hotel" | "mall" | "park" | "groomer" | "vet" | "supplies";

type Listing = {
  id: string;
  name: string;
  category: Category;
  address: string;
  lat: number;
  lng: number;
  note?: string;
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

const SAMPLE_LISTINGS: Listing[] = [
  { id: "1", name: "Dog-Friendly Café (Tanjong Pagar)", category: "cafe", address: "Tanjong Pagar, Singapore", lat: 1.2766, lng: 103.8459, note: "Outdoor seating" },
  { id: "2", name: "East Coast Park", category: "park", address: "East Coast Park, Singapore", lat: 1.3009, lng: 103.9126, note: "Long walking paths" },
  { id: "3", name: "Pet Supplies Shop (Dhoby Ghaut)", category: "supplies", address: "Dhoby Ghaut, Singapore", lat: 1.3004, lng: 103.8458 },
  { id: "4", name: "Dog Groomer (Serangoon)", category: "groomer", address: "Serangoon, Singapore", lat: 1.3496, lng: 103.8737 },
  { id: "5", name: "Vet Clinic (Bukit Timah)", category: "vet", address: "Bukit Timah, Singapore", lat: 1.3327, lng: 103.8076 },
  { id: "6", name: "Dog-Friendly Hotel (Orchard)", category: "hotel", address: "Orchard, Singapore", lat: 1.3048, lng: 103.8318, note: "Check pet policy" },
  { id: "7", name: "Mall (Dog-friendly areas)", category: "mall", address: "Marina Bay area, Singapore", lat: 1.2834, lng: 103.8607 }
];

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

export default function MapDirectory() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

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
          emoji: CATEGORY_EMOJI[l.category]
        }
      }))
    };
  }, [filtered]);

  // Init map once
  useEffect(() => {
    if (!token) return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [103.8198, 1.3521],
      zoom: 10.8
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("listings", {
        type: "geojson",
        data: geojson as any,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "listings",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": ["step", ["get", "point_count"], 16, 20, 22, 50, 28, 100, 34],
          "circle-color": "#111111",
          "circle-opacity": 0.85
        }
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "listings",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12
        },
        paint: {
          "text-color": "#ffffff"
        }
      });

      map.addLayer({
        id: "unclustered",
        type: "symbol",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "emoji"],
          "text-size": 18
        }
      });

      // Click cluster -> zoom in
      map.on("click", "clusters", (e: MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        if (!features.length) return;

        const clusterId = features[0].properties?.cluster_id as number | undefined;
        if (clusterId === undefined) return;

        const source = map.getSource("listings") as GeoJSONSource;

        // typings don't include getClusterExpansionZoom, but it exists at runtime
        (source as any).getClusterExpansionZoom(clusterId, (err: unknown, zoom: number) => {
          if (err) return;
          const coords = (features[0].geometry as any).coordinates as [number, number];
          map.easeTo({ center: coords, zoom });
        });
      });

      // Click point -> popup
      map.on("click", "unclustered", (e: any) => {
        const f = e.features?.[0];
        if (!f) return;

        const coords = (f.geometry.coordinates as [number, number]).slice() as [number, number];
        const p = f.properties as {
          name: string;
          address: string;
          category: Category;
          note?: string;
        };

        new mapboxgl.Popup({ offset: 18 })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family: ui-sans-serif;">
              <div style="font-weight:700;margin-bottom:4px;">${p.name}</div>
              <div style="font-size:12px;opacity:.85;margin-bottom:6px;">${p.address}</div>
              <div style="font-size:12px;">${CATEGORY_LABELS[p.category]}</div>
              ${p.note ? `<div style="font-size:12px;margin-top:6px;opacity:.8;">${p.note}</div>` : ""}
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "clusters", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "clusters", () => (map.getCanvas().style.cursor = ""));
      map.on("mouseenter", "unclustered", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "unclustered", () => (map.getCanvas().style.cursor = ""));
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, geojson]);

  // Update data when filters change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("listings") as GeoJSONSource | undefined;
    if (source) source.setData(geojson as any);
  }, [geojson]);

  // Fly to user location when set
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;
    map.flyTo({ center: [userPos.lng, userPos.lat], zoom: 13 });
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
        <code className="px-1 py-0.5 bg-black/5 rounded">.env.local</code>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">Find dog-friendly places 🐾</div>
            <div className="text-sm opacity-75">Use location, filter categories, explore.</div>
          </div>
          <button
            onClick={useMyLocation}
            className="rounded-xl px-3 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
          >
            Use my location
          </button>
        </div>

        {geoError ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
            {geoError}
          </div>
        ) : null}

        <div className="mt-4">
          <div className="font-semibold mb-2">Categories</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => {
              const on = selectedCategories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={[
                    "rounded-full px-3 py-1.5 text-sm border transition",
                    on ? "bg-black text-white" : "bg-white hover:bg-black/5"
                  ].join(" ")}
                >
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
            className="mt-2 w-full"
          />
        </div>

        <div className="mt-5">
          <div className="font-semibold mb-2">Results ({filtered.length})</div>
          <div className="space-y-2 max-h-[55vh] overflow-auto pr-1">
            {filtered.map((l) => (
              <button
                key={l.id}
                onClick={() => mapRef.current?.flyTo({ center: [l.lng, l.lat], zoom: 14 })}
                className="w-full text-left rounded-2xl border p-3 hover:bg-black/5 transition"
              >
                <div className="font-bold">{l.name}</div>
                <div className="text-sm opacity-75">{l.address}</div>
                <div className="text-xs opacity-70 mt-1">
                  {CATEGORY_LABELS[l.category]}
                  {l.distanceKm != null ? ` • ${l.distanceKm.toFixed(1)} km` : ""}
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

      <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
        <div ref={mapContainerRef} className="h-[72vh] lg:h-[82vh] w-full" />
      </div>
    </div>
  );
}
