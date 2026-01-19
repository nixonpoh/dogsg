import { notFound } from "next/navigation";
import type { Metadata } from "next";
import listingsData from "../../../data/listings.json";
import ListingMiniMap from "../../../components/ListingMiniMap";
import ListingImageCarousel from "../../../components/ListingImageCarousel";

type Category = "cafe" | "hotel" | "mall" | "park" | "groomer" | "vet" | "supplies";

type Listing = {
  id: string;
  slug: string;
  name: string;
  category: Category;
  address: string;
  lat: number;
  lng: number;
  website?: string;
  phone?: string;
  openNow?: boolean | null;
  note?: string;
  writeup?: string,
  rating?: number | null;
  userRatingCount?: number | null;
};

type NearbyListing = Listing & { distanceKm: number };

const CATEGORY_LABELS: Record<Category, string> = {
  cafe: "☕ Cafes",
  hotel: "🏨 Hotels",
  mall: "🛍️ Malls",
  park: "🌳 Parks",
  groomer: "✂️ Groomers",
  vet: "🩺 Vets",
  supplies: "🦴 Pet Supplies",
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.asin(Math.sqrt(x));
}

function getAllListings(): Listing[] {
  return listingsData as Listing[];
}

function getListingBySlug(slug: string): Listing | undefined {
  return getAllListings().find((l) => l.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const listing = getListingBySlug(params.slug);
  if (!listing) return { title: "Listing not found - DogFriendlyPlaces.sg" };
  return { title: `${listing.name} - DogFriendlyPlaces.sg` };
}

export default function ListingPage({ params }: { params: { slug: string } }) {
  const listing = getListingBySlug(params.slug);
  if (!listing) notFound();

  const googleMapsPinUrl = `https://www.google.com/maps?q=${listing.lat},${listing.lng}`;

  const nearby: NearbyListing[] = getAllListings()
    .filter((l) => l.id !== listing.id)
    .map((l) => ({
      ...l,
      distanceKm: haversineKm(
        { lat: listing.lat, lng: listing.lng },
        { lat: l.lat, lng: l.lng }
      ),
    }))
    .filter((l) => l.distanceKm <= 3)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-2">
        <a href="/" className="text-sm font-semibold underline">
          ← Back to map
        </a>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          {/* LEFT */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-xs opacity-70">
              {CATEGORY_LABELS[listing.category]}
            </div>
            <h1 className="mt-2 text-3xl font-extrabold">
              {listing.name}
            </h1>

            <div className="mt-2 text-sm opacity-80">
              <strong>Address:</strong> {listing.address}
            </div>

            <div className="mt-6">
              <ListingMiniMap
                lat={listing.lat}
                lng={listing.lng}
                name={listing.name}
              />
            </div>

            <div className="mt-6">
              <div className="font-semibold mb-2">About</div>
            <div className="rounded-2xl border p-5 text-sm leading-relaxed whitespace-pre-line">
  {listing.writeup ? (
    <div className="space-y-4">{listing.writeup}</div>
  ) : (
    <div className="opacity-70">About content coming soon.</div>
  )}
</div>

            </div>
          </div>

          {/* RIGHT */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <ListingImageCarousel listingId={listing.id} />

            <div className="mt-6 text-lg font-extrabold">
              Nearby places
            </div>

            <div className="mt-4 space-y-2">
              {nearby.map((n) => (
                <a
                  key={n.id}
                  href={`/listing/${n.slug}`}
                  className="block rounded-2xl border p-3 hover:bg-black/5"
                >
                  <div className="font-bold">{n.name}</div>
                  <div className="text-xs opacity-70">
                    {CATEGORY_LABELS[n.category]} •{" "}
                    {n.distanceKm.toFixed(1)} km
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
