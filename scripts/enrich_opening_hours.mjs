import fs from "fs";

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error("Missing GOOGLE_MAPS_API_KEY. Run: export $(cat .env | xargs)");
  process.exit(1);
}

const INPUT = fs.existsSync("data/listings.json") ? "data/listings.json" : null;
if (!INPUT) {
  console.error("Missing data/listings.json");
  process.exit(1);
}

const listings = JSON.parse(fs.readFileSync(INPUT, "utf8"));

const PLACE_DETAILS = (placeId) => `https://places.googleapis.com/v1/places/${placeId}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHours(placeId) {
  const res = await fetch(PLACE_DETAILS(placeId), {
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": [
        "id",
        "openingHours.weekdayDescriptions",
        "openingHours.periods",
        "openingHours.openNow",
        "currentOpeningHours.weekdayDescriptions",
        "currentOpeningHours.openNow"
      ].join(","),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function formatHoursFromWeekdayDescriptions(desc) {
  if (!Array.isArray(desc) || desc.length === 0) return "";
  // Example output: "Monday: 9:00 AM – 9:00 PM; Tuesday: ..."
  return desc.join(" | ");
}

async function main() {
  let updatedCount = 0;
  let missingCount = 0;
  let errorCount = 0;

  const out = [];

  for (let i = 0; i < listings.length; i++) {
    const l = listings[i];
    process.stdout.write(`\rEnriching ${i + 1}/${listings.length} ...`);

    // Only works if id is a Google place id (which yours is)
    if (!l.id) {
      out.push(l);
      continue;
    }

    try {
      const d = await fetchHours(l.id);

      // Prefer "currentOpeningHours" if present (can include special hours)
      const current = d.currentOpeningHours?.weekdayDescriptions;
      const regular = d.openingHours?.weekdayDescriptions;

      const hoursStr = formatHoursFromWeekdayDescriptions(current) || formatHoursFromWeekdayDescriptions(regular);

      if (hoursStr) {
        out.push({
          ...l,
          hours: hoursStr,
          openNow: d.currentOpeningHours?.openNow ?? d.openingHours?.openNow ?? null,
        });
        updatedCount++;
      } else {
        out.push({
          ...l,
          hours: l.hours || "",
          openNow: null,
          hoursNeedsManualCheck: true
        });
        missingCount++;
      }

      // be polite with rate
      await sleep(120);
    } catch (e) {
      out.push({ ...l, hoursEnrichError: e.message });
      errorCount++;
      await sleep(120);
    }
  }

  console.log("\nDone.");
  console.log(`Updated hours: ${updatedCount}`);
  console.log(`Missing hours (manual check): ${missingCount}`);
  console.log(`Errors: ${errorCount}`);

  fs.writeFileSync("data/listings_with_hours.json", JSON.stringify(out, null, 2), "utf8");
  console.log("Saved: data/listings_with_hours.json");
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
