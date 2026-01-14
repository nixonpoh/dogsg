import fs from "fs";

const INPUT = "data/listings.json";
const OUTPUT = "data/listings.parks_verified.json";
const REPORT = "data/parks_verification_report.csv";

const SERPAPI_KEY = process.env.SERPAPI_API_KEY;
if (!SERPAPI_KEY) {
  console.error("❌ Missing SERPAPI_API_KEY");
  console.error("Add it to .env then run: export $(cat .env | xargs)");
  console.error("Example: echo 'SERPAPI_API_KEY=xxxx' >> .env");
  process.exit(1);
}

if (!fs.existsSync(INPUT)) {
  console.error(`❌ Missing ${INPUT}`);
  process.exit(1);
}

const listings = JSON.parse(fs.readFileSync(INPUT, "utf8"));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function norm(s) {
  return (s ?? "").toString().toLowerCase();
}

// Strong "YES dogs allowed" signals
const POSITIVE = [
  "dog friendly",
  "dogs allowed",
  "pets allowed",
  "pet friendly",
  "bring your dog",
  "dogs are allowed",
  "dogs are welcome",
  "dog run",
  "off-leash",
  "off leash",
];

// Strong "NO dogs" signals
const NEGATIVE = [
  "no dogs",
  "dogs are not allowed",
  "dogs not allowed",
  "not allowed to bring dogs",
  "not dog friendly",
  "pets are not allowed",
  "dogs prohibited",
  "prohibited",
  "ban dogs",
  "banned",
  "nature reserve no dogs",
  "no dogs in nature reserves",
];

function decideFromText(text) {
  const t = norm(text);

  // If any negative appears, it overrides
  if (NEGATIVE.some((k) => t.includes(k))) {
    return { verdict: "not_dog_friendly", confidence: "high" };
  }

  // Positive signals
  const hit = POSITIVE.find((k) => t.includes(k));
  if (hit) {
    return { verdict: "dog_friendly", confidence: "medium", reason: `matched:${hit}` };
  }

  return { verdict: "unknown", confidence: "low" };
}

// Build query like user requested
function buildQuery(name) {
  // bias to Singapore context
  return `is ${name} park dog friendly? Singapore`;
}

async function serpSearch(query) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "sg");
  url.searchParams.set("api_key", SERPAPI_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`SerpAPI HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

function pickEvidence(serpJson) {
  const parts = [];

  // organic results snippets
  const organic = serpJson?.organic_results ?? [];
  for (const r of organic.slice(0, 5)) {
    const title = r?.title ?? "";
    const snippet = r?.snippet ?? "";
    const link = r?.link ?? "";
    const combined = `${title} — ${snippet}`.trim();
    if (combined) parts.push({ kind: "organic", text: combined, link });
  }

  // knowledge graph / answer box sometimes contains direct info
  const answerBox = serpJson?.answer_box;
  if (answerBox) {
    const ab = JSON.stringify(answerBox);
    parts.push({ kind: "answer_box", text: ab, link: "" });
  }

  return parts;
}

function csvEscape(s) {
  const str = (s ?? "").toString();
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

async function main() {
  const parks = listings.filter((l) => l?.category === "park" && l?.name);
  console.log(`Found parks: ${parks.length}`);

  const reportRows = [];
  let verifiedCount = 0;
  let notCount = 0;
  let unknownCount = 0;
  let errors = 0;

  // Create quick lookup for updates
  const updatedListings = listings.map((l) => ({ ...l }));

  for (let i = 0; i < parks.length; i++) {
    const park = parks[i];
    const query = buildQuery(park.name);

    process.stdout.write(`\rChecking ${i + 1}/${parks.length}: ${park.name}                     `);

    try {
      const serp = await serpSearch(query);
      const evidenceParts = pickEvidence(serp);

      // Combine top evidence into one text blob for decision
      const evidenceText = evidenceParts.map((p) => p.text).join("\n");

      const decision = decideFromText(evidenceText);

      // Conservative: only mark verified if we have a positive hit
      let newStatus = park.verificationStatus ?? "needs_check";
      let verifiedBy = park.verifiedBy ?? "";

      if (decision.verdict === "dog_friendly") {
        newStatus = "verified";
        verifiedBy = "google_search_snippet";
        verifiedCount++;
      } else if (decision.verdict === "not_dog_friendly") {
        // Keep as needs_check (do NOT mark "not" in your system unless you want)
        newStatus = "needs_check";
        notCount++;
      } else {
        unknownCount++;
      }

      // Write back to listing
      const idx = updatedListings.findIndex((l) => l.id === park.id);
      if (idx >= 0) {
        updatedListings[idx].verificationStatus = newStatus;
        updatedListings[idx].verifiedBy = verifiedBy;

        // Store a tiny audit trail (no long text, just keywords)
        updatedListings[idx].parkVerification = {
          query,
          verdict: decision.verdict,
          confidence: decision.confidence,
          reason: decision.reason ?? "",
          checkedAt: new Date().toISOString(),
        };
      }

      // Report row
      reportRows.push({
        id: park.id,
        name: park.name,
        address: park.address ?? "",
        verdict: decision.verdict,
        confidence: decision.confidence,
        setVerificationStatus: newStatus,
        reason: decision.reason ?? "",
        query,
        topLink: (serp?.organic_results?.[0]?.link ?? ""),
      });

      // Polite rate limit (avoid getting blocked / burning quota)
      await sleep(350);
    } catch (e) {
      errors++;
      reportRows.push({
        id: park.id,
        name: park.name,
        address: park.address ?? "",
        verdict: "error",
        confidence: "low",
        setVerificationStatus: park.verificationStatus ?? "needs_check",
        reason: e.message,
        query,
        topLink: "",
      });
      await sleep(350);
    }
  }

  console.log("\nDone.");
  console.log(`✅ Verified (dog friendly): ${verifiedCount}`);
  console.log(`🚫 Not dog friendly signals found: ${notCount}`);
  console.log(`❓ Unknown: ${unknownCount}`);
  console.log(`⚠️ Errors: ${errors}`);

  fs.writeFileSync(OUTPUT, JSON.stringify(updatedListings, null, 2), "utf8");

  // CSV report
  const header = [
    "id",
    "name",
    "address",
    "verdict",
    "confidence",
    "setVerificationStatus",
    "reason",
    "query",
    "topLink",
  ].join(",");

  const csv = [
    header,
    ...reportRows.map((r) =>
      [
        csvEscape(r.id),
        csvEscape(r.name),
        csvEscape(r.address),
        csvEscape(r.verdict),
        csvEscape(r.confidence),
        csvEscape(r.setVerificationStatus),
        csvEscape(r.reason),
        csvEscape(r.query),
        csvEscape(r.topLink),
      ].join(",")
    ),
  ].join("\n");

  fs.writeFileSync(REPORT, csv, "utf8");

  console.log(`Saved updated listings: ${OUTPUT}`);
  console.log(`Saved report: ${REPORT}`);
}

main().catch((e) => {
  console.error("\nFAILED:", e);
  process.exit(1);
});
