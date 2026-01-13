import fs from "fs";

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error("Missing GOOGLE_MAPS_API_KEY. Example: export $(cat .env | xargs)");
  process.exit(1);
}

const INPUT =
  fs.existsSync("data/listings_sg_clean.json") ? "data/listings_sg_clean.json" :
  fs.existsSync("data/listings.json") ? "data/listings.json" :
  null;

if (!INPUT) {
  console.error("Missing input JSON. Expected data/listings_sg_clean.json or data/listings.json");
  process.exit(1);
}

const OUT_JSON = "data/listings_sg_reviews_verified.json";
const OUT_CSV = "data/listings_sg_reviews_verified.csv";

const listings = JSON.parse(fs.readFileSync(INPUT, "utf8"));

const PLACE_DETAILS = (placeId) => `https://places.googleapis.com/v1/places/${placeId}`;

// Keywords for “dog friendly” evidence in reviews
const STRONG = [
  "dog friendly", "dog-friendly", "pet friendly", "pet-friendly",
  "pets allowed", "dogs allowed", "allowed our dog", "brought my dog",
  "bring my dog", "bring our dog", "with my dog", "with our dog",
  "furkid", "fur kid", "leash", "off leash", "off-leash",
  "pet policy", "pet policies"
];

// Some places use “pet” without meaning allowed onsite; keep as weak evidence if needed later
const WEAK = [
  "dog", "dogs", "pet", "pets", "puppy", "pup", "canine"
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function norm(s) {
  return (s ?? "").toString().toLowerCase();
}

function scanText(text) {
  const t = norm(text);
  const strongHits = STRONG.filter(k => t.includes(k));
  const weakHits = WEAK.filter(k => t.includes(k));
  return {
    strongHits: Array.from(new Set(strongHits)),
    weakHits: Array.from(new Set(weakHits))
  };
}

async function fetchPlaceDetailsWithReviews(placeId) {
  const res = await fetch(PLACE_DETAILS(placeId), {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": API_KEY,
      // Request only what we need (FieldMask required)
      "X-Goog-FieldMask": [
        "id",
        "displayName",
        "formattedAddress",
        "location",
        "rating",
        "userRatingCount",
        "reviews.text.text",
        "reviews.relativePublishTimeDescription",
        "reviews.rating"
      ].join(",")
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Place Details error ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  // We’ll check EVERYTHING (all categories), but you can later restrict to needs_check only.
  const updated = [];
  let checked = 0;
  let upgraded = 0;
  let errors = 0;

  for (const l of listings) {
    checked += 1;
    process.stdout.write(`\rChecking reviews ${checked}/${listings.length} ...`);

    // Skip if missing place id
    if (!l.id) {
      updated.push(l);
      continue;
    }

    try {
      const details = await fetchPlaceDetailsWithReviews(l.id);
      const reviews = details.reviews ?? [];

      let totalStrongMentions = 0;
      const keywordSet = new Set();

      // Scan each returned review’s text
      for (const r of reviews) {
        const txt = r?.text?.text ?? "";
        if (!txt) continue;
        const hits = scanText(txt);
        if (hits.strongHits.length) {
          totalStrongMentions += hits.strongHits.length;
          hits.strongHits.forEach(k => keywordSet.add(k));
        }
      }

      const hasStrongEvidence = totalStrongMentions > 0;

      const next = { ...l };

      // Store evidence summary (NOT raw review text)
      next.reviewEvidence = {
        scannedReviews: Array.isArray(reviews) ? reviews.length : 0,
        dogFriendlyMentions: totalStrongMentions,
        keywords: Array.from(keywordSet).slice(0, 12)
      };

      // If we found strong evidence, upgrade
      if (hasStrongEvidence) {
        if (next.verificationStatus !== "verified") upgraded += 1;
        next.verificationStatus = "verified";
        next.verifiedBy = "reviews";
      } else {
        // keep existing status (don’t downgrade)
        next.verifiedBy = next.verifiedBy || "";
      }

      updated.push(next);

      // polite rate limit
      await sleep(150);
    } catch (e) {
      errors += 1;
      // Keep original listing but record error
      updated.push({ ...l, reviewEvidenceError: e.message });
      await sleep(150);
    }
  }

  console.log("\nDone.");
  console.log(`Checked: ${checked}, Upgraded to verified via reviews: ${upgraded}, Errors: ${errors}`);

  fs.writeFileSync(OUT_JSON, JSON.stringify(updated, null, 2), "utf8");

  // CSV
  const header = [
    "id","name","category","verificationStatus","verifiedBy",
    "rating","userRatingCount",
    "scannedReviews","dogFriendlyMentions","keywords",
    "address","lat","lng","website","phone"
  ].join(",");

  const rows = updated.map(p => [
    p.id,
    JSON.stringify(p.name || ""),
    p.category || "",
    p.verificationStatus || "",
    p.verifiedBy || "",
    p.rating ?? "",
    p.userRatingCount ?? "",
    p.reviewEvidence?.scannedReviews ?? "",
    p.reviewEvidence?.dogFriendlyMentions ?? "",
    JSON.stringify((p.reviewEvidence?.keywords || []).join("|")),
    JSON.stringify(p.address || ""),
    p.lat ?? "",
    p.lng ?? "",
    JSON.stringify(p.website || ""),
    JSON.stringify(p.phone || "")
  ].join(","));

  fs.writeFileSync(OUT_CSV, [header, ...rows].join("\n"), "utf8");

  console.log(`Saved: ${OUT_JSON}`);
  console.log(`Saved: ${OUT_CSV}`);
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
