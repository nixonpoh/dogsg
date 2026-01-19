import fs from "fs";

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const path = "./data/listings.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));

const used = new Map(); // slug -> count

const out = data.map((item) => {
  const base = slugify(item.name || "place");
  const count = used.get(base) || 0;
  used.set(base, count + 1);

  const slug = count === 0 ? base : `${base}-${count + 1}`;

  return { ...item, slug };
});

fs.writeFileSync(path, JSON.stringify(out, null, 2));
console.log("✅ slugs added to data/listings.json");
