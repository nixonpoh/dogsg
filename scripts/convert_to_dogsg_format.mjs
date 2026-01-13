import fs from "fs";

const inPath = "data/listings_google.json";
const outPath = "data/listings.json";

if (!fs.existsSync(inPath)) {
  console.error(`Missing ${inPath}. Run the extractor first.`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inPath, "utf8"));

/**
 * Input rows look like:
 * {
 *  id, name, address, lat, lng, rating, userRatingCount,
 *  website, phone, categories: ["cafe","park",...], types:[...]
 * }
 */

function pickCategory(p) {
  // Prefer your known categories if present
  const allowed = new Set(["cafe","hotel","mall","park","groomer","vet","supplies"]);
  const cats = Array.isArray(p.categories) ? p.categories : [];
  const firstAllowed = cats.find(c => allowed.has(c));
  if (firstAllowed) return firstAllowed;

  // Fallback heuristic from Google 'types'
  const types = Array.isArray(p.types) ? p.types : [];
  const t = types.join(" ").toLowerCase();

  if (t.includes("veterinary") || t.includes("animal_hospital")) return "vet";
  if (t.includes("pet_store")) return "supplies";
  if (t.includes("park")) return "park";
  if (t.includes("shopping_mall")) return "mall";
  if (t.includes("lodging")) return "hotel";
  if (t.includes("cafe") || t.includes("restaurant")) return "cafe";

  // Default bucket
  return "cafe";
}

function cleanStr(s) {
  return (s ?? "").toString().trim();
}

const out = raw
  .filter(p => p && p.id && p.name && typeof p.lat === "number" && typeof p.lng === "number")
  .map(p => {
    const category = pickCategory(p);

    return {
      id: String(p.id),
      name: cleanStr(p.name),
      category,
      address: cleanStr(p.address),
      lat: Number(p.lat),
      lng: Number(p.lng),

      // Your directory fields (placeholders you can fill later)
      website: cleanStr(p.website),
      phone: cleanStr(p.phone),
      hours: "",        // fill later
      priceRange: "",   // fill later
      petPolicy: "",    // fill later
      note: "",         // fill later
      images: [],       // fill later (official images only)

      // Keep these (useful for sorting / QA)
      rating: typeof p.rating === "number" ? p.rating : null,
      userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,

      // Keep for debugging (optional)
      googleTypes: Array.isArray(p.types) ? p.types : [],
      source: "google_places_api"
    };
  })
  // Optional: sort by review count desc, then rating desc
  .sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0) || (b.rating ?? 0) - (a.rating ?? 0));

fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(`Converted ${out.length} listings -> ${outPath}`);
console.log(`Example:\n${out[0] ? `${out[0].name} | ${out[0].rating}⭐ | ${out[0].userRatingCount} reviews` : "No rows"}`);
