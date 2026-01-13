"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export default function ListingMiniMap({
  lat,
  lng,
  name
}: {
  lat: number;
  lng: number;
  name: string;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!token) return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: 14
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    new mapboxgl.Marker()
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(name))
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, lat, lng, name]);

  if (!token) {
    return (
      <div className="rounded-xl border bg-white p-4 text-sm">
        Missing <code className="px-1 py-0.5 bg-black/5 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code>
      </div>
    );
  }

  return <div ref={mapContainerRef} className="h-64 w-full rounded-2xl border overflow-hidden" />;
}
