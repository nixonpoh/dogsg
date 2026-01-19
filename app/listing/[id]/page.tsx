import { notFound } from "next/navigation";
import type { Metadata } from "next";
import listingsData from "../../../data/listings.json";
import ListingMiniMap from "../../../components/ListingMiniMap";
import ListingImageCarousel from "../../../components/ListingImageCarousel";

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

  openNow?: boolean | null;

  note?: string;

  // ✅ NEW
  writeup?: string;

  rating?: number | null;
  userRatingCount?: number | null;

  verificationStatus?: "verified" | "needs_check";
  verifiedBy?: string;
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

  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

function getAllListings(): Listing[] {
  return listingsData as Listing[];
}

function getListing(id: string): Listing | undefined {
  return getAllListings().find((l) => l.id === id);
}

function prettyUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const listing = getListing(params.id);
  if (!listing) return { title: "Listing not found - DogSG" };
  return { title: `${listing.name} - DogSG` };
}

export default function ListingPage({ params }: { params: { id: string } }) {
  const listing = getListing(params.id);
  if (!listing) notFound();

  const googleMapsPinUrl = `https://www.google.com/maps?q=${listing.lat},${listing.lng}`;

  const nearby: NearbyListing[] = getAllListings()
    .filter((l) => l.id !== listing.id)
    .map((l) => ({
      ...l,
      distanceKm: haversineKm({ lat: listing.lat, lng: listing.lng }, { lat: l.lat, lng: l.lng }),
    }))
    .filter((l) => l.distanceKm <= 3)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);

  const website = listing.website?.trim();
  const phone = listing.phone?.trim();
  const showOpenNow = typeof listing.openNow === "boolean";

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-2">
        <a href="/" className="text-sm font-semibold underline">
          ← Back to map
        </a>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          {/* MAIN */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs opacity-70">{CATEGORY_LABELS[listing.category]}</div>
                <h1 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">{listing.name}</h1>

                <div className="mt-2 text-sm opacity-80">
                  <span className="font-semibold">Address:</span> {listing.address}
                </div>

                {(typeof listing.rating === "number" || typeof listing.userRatingCount === "number") && (
                  <div className="mt-2 text-sm opacity-80">
                    <span className="font-semibold">From Google: </span>{" "}
                    {typeof listing.rating === "number" ? `${listing.rating}⭐` : ""}
                    {typeof listing.userRatingCount === "number" ? ` • ${listing.userRatingCount} reviews` : ""}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                {showOpenNow && (
                  <span
                    className={[
                      "text-[11px] px-2 py-1 rounded-full border whitespace-nowrap",
                      listing.openNow ? "bg-blue-600 text-white border-blue-600" : "bg-white",
                    ].join(" ")}
                  >
                    {listing.openNow ? "Open now" : "Closed now"}
                  </span>
                )}
              </div>
            </div>

            {listing.note && (
              <div className="mt-4 rounded-2xl border bg-black/5 p-4 text-sm">
                <div className="font-semibold mb-1">Notes</div>
                <div className="opacity-80">{listing.note}</div>
              </div>
            )}

            {/* ACTIONS ABOVE MAP */}
            <div className="mt-4 flex flex-col gap-2">
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-black/5"
                >
                  Website ({prettyUrl(website)})
                </a>
              )}

              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="w-full rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-black/5"
                >
                  Call {phone}
                </a>
              )}

              <a
                href={googleMapsPinUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-black/5"
              >
                Open in Google Maps
              </a>
            </div>

            {/* MAP */}
            <div className="mt-6">
              <div className="text-sm font-semibold mb-2">Map</div>
              <ListingMiniMap lat={listing.lat} lng={listing.lng} name={listing.name} />
            </div>

            {/* ABOUT */}
            <div className="mt-8">
              <div className="text-sm font-semibold mb-2">About</div>

              <div className="rounded-2xl border bg-white p-5 text-sm leading-relaxed">
                {listing.writeup ? (
                  <div className="space-y-4 whitespace-pre-line">{listing.writeup}</div>
                ) : (
                  <div className="opacity-70">About content coming soon.</div>
                )}
              </div>
            </div>
          </div>

          {/* NEARBY */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            {/* ✅ NEW: Image Carousel */}
            <div className="mb-4">
              <ListingImageCarousel listingId={listing.id} />
            </div>

            <div className="text-lg font-extrabold">Nearby places</div>
            <div className="text-sm opacity-75">Within ~3 km</div>

            <div className="mt-4 space-y-2">
              {nearby.map((n) => (
                <a
                  key={n.id}
                  href={`/listing/${n.id}`}
                  className="block rounded-2xl border p-3 hover:bg-black/5 transition"
                >
                  <div className="font-bold">{n.name}</div>
                  <div className="text-sm opacity-75">{n.address}</div>
                  <div className="text-xs opacity-70 mt-1">
                    {CATEGORY_LABELS[n.category as Category]} • {n.distanceKm.toFixed(1)} km
                  </div>
                </a>
              ))}

              {nearby.length === 0 && (
                <div className="rounded-xl border p-3 text-sm opacity-70">No nearby listings yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
