import fs from "fs";

const INPUT = "data/listings.json";
const OUTPUT = "data/listings_clean.json";

const listings = JSON.parse(fs.readFileSync(INPUT, "utf8"));

const cleaned = listings.map((l) => {
  const {
    hours,
    priceRange,
    hoursEnrichError,
    ...rest
  } = l;

  // Only keep openNow if it's a boolean, otherwise set to null
  if (typeof rest.openNow !== "boolean") {
    rest.openNow = null;
  }

  return rest;
});

fs.writeFileSync(OUTPUT, JSON.stringify(cleaned, null, 2), "utf8");

console.log(`✅ Cleaned listings saved to ${OUTPUT}`);
