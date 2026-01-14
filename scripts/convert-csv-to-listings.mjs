import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const csvPath = path.join(process.cwd(), "data", "listings_sg_reviews_verified_1.csv");
const outPath = path.join(process.cwd(), "data", "listings.json");

const csvText = fs.readFileSync(csvPath, "utf8");

// Auto-detect delimiter from the header line
const firstLine = csvText.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
const delimiter = firstLine.includes("\t")
  ? "\t"
  : firstLine.includes(";")
  ? ";"
  : ",";

const records = parse(csvText, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_quotes: true,
  relax_column_count: true,
  delimiter,
});

// Map CSV columns -> your listings.json structure
// IMPORTANT: These keys (name, category, address, lat, lng...) must match your CSV header names.
const listings = records.map((r, idx) => ({
  id: String(r.id || idx + 1),
  name: r.name || r.Name || "",
  category: (r.category || r.Category || "").toLowerCase(),
  address: r.address || r.Address || "",
  lat: Number(r.lat || r.Lat || 0),
  lng: Number(r.lng || r.Lng || r.Long || r.Longitude || 0),

  website: (r.website || r.Website || "").trim() || undefined,
  phone: (r.phone || r.Phone || "").trim() || undefined,

  rating: r.rating || r.Rating ? Number(r.rating || r.Rating) : null,
  userRatingCount:
    r.userRatingCount || r.UserRatingCount || r.reviews || r.Reviews
      ? Number(r.userRatingCount || r.UserRatingCount || r.reviews || r.Reviews)
      : null,

  verificationStatus: (r.verificationStatus || r.VerificationStatus || "").trim() || undefined,
  verifiedBy: (r.verifiedBy || r.VerifiedBy || "").trim() || undefined,

  openNow:
    String(r.openNow || r.OpenNow || "").toLowerCase() === "true"
      ? true
      : String(r.openNow || r.OpenNow || "").toLowerCase() === "false"
      ? false
      : null,

  note: (r.note || r.Note || "").trim() || undefined,
}));

fs.writeFileSync(outPath, JSON.stringify(listings, null, 2), "utf8");
console.log(`✅ Detected delimiter: ${JSON.stringify(delimiter)}`);
console.log(`✅ Converted ${listings.length} rows -> data/listings.json`);
