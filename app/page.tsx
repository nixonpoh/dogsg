import dynamic from "next/dynamic";

// Disable SSR for MapDirectory to prevent hydration mismatch with Mapbox
const MapDirectory = dynamic(() => import("@/components/MapDirectory"), { ssr: false });

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <MapDirectory />
      </div>
    </main>
  );
}
