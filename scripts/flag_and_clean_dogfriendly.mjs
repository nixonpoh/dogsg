import fs from "fs";

const IN = fs.existsSync("data/listings_google_sg.json")
  ? "data/listings_google_sg.json"
  : "data/listings_google.json";

if (!fs.existsSync(IN)) {
  console.error("Missing input. Expected data/listings_google_sg.json (preferred) or data/listings_google.json");
  process.exit(1);
}

const OUT_JSON = "data/listings_sg_clean.json";
const OUT_CSV = "data/listings_sg_clean.csv";
const OUT_REJECTS_JSON = "data/listings_sg_rejected.json";

const rows = JSON.parse(fs.readFileSync(IN, "utf8"));

/**
 * Keyword evidence for dog/pet friendliness
 * Strong signals => "verified"
 * Weak/none => "needs_check"
 */
const PET_STRONG = [
  "dog friendly", "pet friendly", "pets allowed", "dogs allowed",
  "dog-friendly", "pet-friendly", "dog cafe", "dog café",
  "dog park", "off leash", "off-leash",
  "pet hotel", "dog hotel", "pet boarding", "dog boarding",
  "pet grooming", "dog grooming"
];

const PET_WEAK = [
  "pet", "pets", "dog", "dogs", "puppy", "canine", "paw",
  "groom", "grooming", "vet", "veterinary", "animal", "cat", "cats"
];

// For obvious false positive removal: expected signals per category
const EXPECTED_BY_CATEGORY = {
  cafe: {
    typesAny: ["cafe", "restaurant", "bar", "bakery", "food"],
    nameAny: ["cafe", "café", "coffee", "bistro", "restaurant", "bar", "bakery"]
  },
  hotel: {
    typesAny: ["lodging"],
    nameAny: ["hotel", "resort", "inn", "hostel", "stay", "suites", "serviced apartment", "serviced apartments"]
  },
  mall: {
    typesAny: ["shopping_mall"],
    nameAny: ["mall", "plaza", "centre", "center", "galleria", "city", "square"]
  },
  park: {
    typesAny: ["park"],
    nameAny: ["park", "garden", "gardens", "reservoir", "green", "nature"]
  },
  groomer: {
    typesAny: ["pet_store"],
    nameAny: ["groom", "grooming", "pet salon", "petshop", "pet shop"]
  },
  vet: {
    typesAny: ["veterinary_care"],
    nameAny: ["vet", "vets", "veterinary", "animal hospital", "clinic"]
  },
  supplies: {
    typesAny: ["pet_store"],
    nameAny: ["pet", "pets", "petshop", "pet shop", "supplies", "aquarium", "koi", "bird"]
  }
};

function norm(s) {
  return (s ?? "").toString().toLowerCase().trim();
}

function hasAny(hay, needles) {
  const h = norm(hay);
  return needles.some(n => h.includes(n));
}

function typesHasAny(types, needles) {
  const t = Array.isArray(types) ? types.join(" ").toLowerCase() : "";
  return needles.some(n => t.includes(n));
}

function petEvidenceScore(place) {
  const text = `${place.name || ""} ${place.address || ""}`.toLowerCase();
  const strong = PET_STRONG.some(k => text.includes(k));
  if (strong) return "strong";
  const weak = PET_WEAK.some(k => text.includes(k));
  return weak ? "weak" : "none";
}

/**
 * Remove obvious false positives:
 * - category mismatch: e.g. "hotel" but not lodging and name doesn't look like hotel
 * - cafe that isn't food/cafe-ish at all
 * - mall that isn't mall-ish at all
 * - park that isn't park-ish at all
 * - groomer/supplies/vet should match expected type/name signals
 */
function isObviousMismatch(place) {
  const cat = place.category;
  const expect = EXPECTED_BY_CATEGORY[cat];
  if (!expect) return false;

  const nameOk = hasAny(place.name, expect.nameAny);
  const typesOk = typesHasAny(place.types || place.googleTypes, expect.typesAny);

  // For stricter categories:
  if (cat === "hotel") return !(typesOk || nameOk);
  if (cat === "mall") return !(typesOk || nameOk);
  if (cat === "park") return !(typesOk || nameOk);

  // For vet/groomer/supplies: if it doesn't look like it at all, reject
  if (cat === "vet" || cat === "groomer" || cat === "supplies") return !(typesOk || nameOk);

  // Cafe: allow restaurant/food types OR cafe-ish name
  if (cat === "cafe") return !(typesOk || nameOk);

  return false;
}

/**
 * Verification status:
 * - "verified": strong pet/dog wording OR category inherently pet-specific (vet/groomer/supplies) with decent matching
 * - "needs_check": everything else that passes the basic sanity filters
 */
function verificationStatus(place) {
  const ev = petEvidenceScore(place);
  const cat = place.category;

  // Pet-industry categories are very likely relevant even if not explicitly "pet friendly"
  if (cat === "vet" || cat === "groomer" || cat === "supplies") return "verified";

  // Parks: only "verified" if explicit dog-park/off-leash/pet-friendly wording
  if (cat === "park") return ev === "strong" ? "verified" : "needs_check";

  // Cafes/hotels/malls are commonly false positives; require strong evidence to mark verified
  if (cat === "cafe" || cat === "hotel" || cat === "mall") return ev === "strong" ? "verified" : "needs_check";

  return ev === "strong" ? "verified" : "needs_check";
}

const cleaned = [];
const rejected = [];

for (const p of rows) {
  // basic sanity
  if (!p || !p.id || !p.name) continue;
  if (typeof p.lat !== "number" || typeof p.lng !== "number") continue;

  // remove obvious mismatches
  if (isObviousMismatch(p)) {
    rejected.push({ ...p, rejectReason: "obvious_category_mismatch" });
    continue;
  }

  // keep & flag
  const out = {
    id: String(p.id),
    name: p.name,
    category: p.category,
    address: p.address || "",
    lat: p.lat,
    lng: p.lng,

    website: p.website || "",
    phone: p.phone || "",
    hours: p.hours || "",
    priceRange: p.priceRange || "",
    petPolicy: p.petPolicy || "",
    note: p.note || "",
    images: Array.isArray(p.images) ? p.images : [],

    rating: typeof p.rating === "number" ? p.rating : null,
    userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,

    verificationStatus: verificationStatus(p),
    // helpful for later QA
    categories: Array.isArray(p.categories) ? p.categories : undefined,
    googleTypes: Array.isArray(p.types) ? p.types : (Array.isArray(p.googleTypes) ? p.googleTypes : [])
  };

  cleaned.push(out);
}

// Save JSON
fs.writeFileSync(OUT_JSON, JSON.stringify(cleaned, null, 2), "utf8");
fs.writeFileSync(OUT_REJECTS_JSON, JSON.stringify(rejected, null, 2), "utf8");

// Save CSV
const header = [
  "id","name","category","verificationStatus","address","lat","lng",
  "rating","userRatingCount","website","phone"
].join(",");

const csvRows = cleaned.map(p => [
  p.id,
  JSON.stringify(p.name),
  p.category,
  p.verificationStatus,
  JSON.stringify(p.address),
  p.lat,
  p.lng,
  p.rating ?? "",
  p.userRatingCount ?? "",
  JSON.stringify(p.website || ""),
  JSON.stringify(p.phone || "")
].join(","));

fs.writeFileSync(OUT_CSV, [header, ...csvRows].join("\n"), "utf8");

console.log(`Input: ${IN}`);
console.log(`Kept: ${cleaned.length} -> ${OUT_JSON} and ${OUT_CSV}`);
console.log(`Rejected: ${rejected.length} -> ${OUT_REJECTS_JSON}`);

const counts = cleaned.reduce((acc, p) => {
  acc[p.verificationStatus] = (acc[p.verificationStatus] || 0) + 1;
  return acc;
}, {});
console.log("Verification counts:", counts);

// Breakdown by category
const byCat = cleaned.reduce((acc, p) => {
  acc[p.category] = (acc[p.category] || 0) + 1;
  return acc;
}, {});
console.log("By category:", byCat);
