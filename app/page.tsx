import MapDirectory from "@/components/MapDirectory";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 shadow-sm">
            <span className="text-lg">🐶</span>
            <span className="text-sm font-semibold">DogSG Directory</span>
          </div>

          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight">
            Find dog-friendly places in Singapore
          </h1>
          <p className="mt-3 text-base md:text-lg opacity-80 max-w-2xl">
            Cafés, hotels, malls, parks, groomers, vets, pet supplies — all on one map.
          </p>
        </div>

        <MapDirectory />
      </div>
    </main>
  );
}
