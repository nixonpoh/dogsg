import fs from "fs";

const inJson = "data/listings_google.json";
const outJson = "data/listings_google_sg.json";
const outCsv = "data/listings_google_sg.csv";

if (!fs.existsSync(inJson)) {
  console.error("Missing data/listings_google.json");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inJson, "utf8"));

/**
 * Singapore bounding box (tight + safe)
 */
const SG = {
  minLat: 1.15,
  maxLat: 1.48,
  minLng: 103.60,
  maxLng: 104.10
};

function isInSingaporeLatLng(p) {
  return (
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    p.lat >= SG.minLat &&
    p.lat <= SG.maxLat &&
    p.lng >= SG.minLng &&
    p.lng <= SG.maxLng
  );
}

function addressLooksSingapore(addr) {
  if (!addr) return false;
  const a = addr.toLowerCase();
  return (
    a.includes("singapore") ||
    a.includes(" sg ") ||
    a.endsWith(" sg") ||
    a.includes(" singapore ")
  );
}

const sgOnly = data.filter(p =>
  isInSingaporeLatLng(p) && addressLooksSingapore(p.address)
);

console.log(`Before: ${data.length}`);
console.log(`After (Singapore only): ${sgOnly.length}`);

// Write JSON
fs.writeFileSync(outJson, JSON.stringify(sgOnly, null, 2), "utf8");

// Write CSV
const csvHeader = [
  "id",
  "name",
  "categories",
  "address",
  "lat",
  "lng",
  "rating",
  "userRatingCount",
  "website",
  "phone"
].join(",");

const csvRows = sgOnly.map(p => [
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

fs.writeFileSync(outCsv, [csvHeader, ...csvRows].join("\n"), "utf8");

console.log(`Saved: ${outJson}`);
console.log(`Saved: ${outCsv}`);
