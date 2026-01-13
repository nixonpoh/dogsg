import fs from "fs";

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error("Missing GOOGLE_MAPS_API_KEY. Put it in .env and export it, or run: GOOGLE_MAPS_API_KEY=... node scripts/extract_places_sg.mjs");
  process.exit(1);
}

/**
 * Google Places API (New) - Text Search
 * POST https://places.googleapis.com/v1/places:searchText
 * Requires X-Goog-Api-Key and X-Goog-FieldMask
 */
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// Singapore rough bounding box (good enough for grid scan)
const SG_BOUNDS = {
  minLat: 1.16,
  maxLat: 1.48,
  minLng: 103.60,
  maxLng: 104.10
};

// Grid step in degrees (~2.2km latitude). You can tighten later.
const STEP = 0.02;

// Search radius (meters) for location bias
const RADIUS_M = 2000;

// Your categories/queries (you can tweak keywords any time)
const QUERIES = [
  // Cafes
  { category: "cafe", q: "dog friendly cafe" },
  { category: "cafe", q: "pet friendly cafe" },

  // Hotels
  { category: "hotel", q: "pet friendly hotel" },
  { category: "hotel", q: "dog friendly hotel" },

  // Malls
  { category: "mall", q: "pet friendly mall" },
  { category: "mall", q: "dog friendly mall" },

  // Parks
  { category: "park", q: "dog park" },
  { category: "park", q: "pet friendly park" },

  // Groomers
  { category: "groomer", q: "pet groomer" },
  { category: "groomer", q: "dog grooming" },

  // Vets
  { category: "vet", q: "veterinary clinic" },
  { category: "vet", q: "animal hospital" },

  // Pet supplies
  { category: "supplies", q: "pet store" },
  { category: "supplies", q: "pet supplies" }
];

const FILTER_MIN_RATING = 4.0;
const FILTER_MIN_REVIEWS = 100;

// polite pacing (avoid hammering)
const SLEEP_MS = 120;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function* gridPoints(bounds, step) {
  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += step) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += step) {
      yield { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
    }
  }
}

async function placesTextSearch({ textQuery, lat, lng, radiusM, pageToken }) {
  const body = {
    textQuery,
    // locationBias circle: favors results near this point
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusM
      }
    },
    // return up to 20 per page; use nextPageToken for more
    pageSize: 20
  };

  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      // Only request what we need (reduces cost/size)
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.websiteUri",
        "places.nationalPhoneNumber",
        "places.types",
        "nextPageToken"
      ].join(",")
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Places API error ${res.status}: ${text}`);
  }
  return res.json();
}

function toListing(place, categoryHint) {
  const name = place?.displayName?.text ?? "";
  const loc = place?.location ?? {};
  const rating = place?.rating ?? null;
  const reviews = place?.userRatingCount ?? null;

  // output shape close to your existing data/listings.json
  return {
    id: place.id,
    name,
    category: categoryHint, // heuristic category (from query)
    address: place.formattedAddress ?? "",
    lat: loc.latitude ?? null,
    lng: loc.longitude ?? null,
    rating,
    userRatingCount: reviews,
    website: place.websiteUri ?? "",
    phone: place.nationalPhoneNumber ?? "",
    types: place.types ?? []
  };
}

async function main() {
  const said = [];
  const byId = new Map(); // placeId -> merged listing
  const points = Array.from(gridPoints(SG_BOUNDS, STEP));
  const totalJobs = points.length * QUERIES.length;

  console.log(`Grid points: ${points.length}`);
  console.log(`Queries: ${QUERIES.length}`);
  console.log(`Total jobs: ${totalJobs} (each job may page)`);

  let done = 0;

  for (const { lat, lng } of points) {
    for (const { category, q } of QUERIES) {
      done += 1;
      process.stdout.write(`\rScanning ${done}/${totalJobs} ...`);

      let pageToken = undefined;
      let pages = 0;

      while (true) {
        pages += 1;
        const data = await placesTextSearch({
          textQuery: q,
          lat,
          lng,
          radiusM: RADIUS_M,
          pageToken
        });

        const places = data.places ?? [];
        for (const p of places) {
          const listing = toListing(p, category);

          // must have coords
          if (listing.lat == null || listing.lng == null) continue;

          // filter
          if (listing.rating == null || listing.userRatingCount == null) continue;
          if (listing.rating < FILTER_MIN_RATING) continue;
          if (listing.userRatingCount < FILTER_MIN_REVIEWS) continue;

          // dedupe + merge categories
          if (!byId.has(listing.id)) {
            byId.set(listing.id, { ...listing, categories: [listing.category] });
          } else {
            const existing = byId.get(listing.id);
            if (!existing.categories.includes(listing.category)) existing.categories.push(listing.category);

            // keep best data if missing
            existing.website = existing.website || listing.website;
            existing.phone = existing.phone || listing.phone;
            existing.address = existing.address || listing.address;
            existing.rating = existing.rating ?? listing.rating;
            existing.userRatingCount = existing.userRatingCount ?? listing.userRatingCount;
            existing.types = Array.from(new Set([...(existing.types || []), ...(listing.types || [])]));
          }
        }

        pageToken = data.nextPageToken;
        if (!pageToken) break;

        // small wait between pages
        await sleep(250);
        // safety: don’t page forever
        if (pages >= 3) break;
      }

      await sleep(SLEEP_MS);
    }
  }

  console.log("\nDone scanning.");
  const results = Array.from(byId.values())
    .sort((a, b) => (b.userRatingCount - a.userRatingCount) || (b.rating - a.rating));

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/listings_google.json", JSON.stringify(results, null, 2), "utf8");

  console.log(`Saved ${results.length} places to data/listings_google.json`);
  console.log("Top 10:");
  console.log(results.slice(0, 10).map(p => `${p.name} | ${p.rating}⭐ | ${p.userRatingCount} reviews`).join("\n"));

  // Optional: also output CSV
  const csvHeader = ["id","name","categories","address","lat","lng","rating","userRatingCount","website","phone"].join(",");
  const csvRows = results.map(p => [
    p.id,
    JSON.stringify(p.name),
    JSON.stringify((p.categories || []).join("|")),
    JSON.stringify(p.address),
    p.lat,
    p.lng,
    p.rating,
    p.userRatingCount,
    JSON.stringify(p.website || ""),
    JSON.stringify(p.phone || "")
  ].join(","));
  fs.writeFileSync("data/listings_google.csv", [csvHeader, ...csvRows].join("\n"), "utf8");
  console.log("Also saved data/listings_google.csv");
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
