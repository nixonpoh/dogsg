import dynamic from "next/dynamic";

const MapDirectory = dynamic(() => import("@/components/MapDirectory"), { ssr: false });

export default function HomePage() {
  return (
    <div className="h-full">
      <div className="mx-auto h-full max-w-6xl px-4 py-0">
        <MapDirectory />
      </div>
    </div>
  );
}
