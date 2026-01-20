import type { MetadataRoute } from "next";
import listings from "../data/listings.json";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://dogfriendlyplaces.vercel.app";

  const urls = (listings as any[])
    .filter((l) => l.slug) // only those that have slug
    .map((l) => ({
      url: `${baseUrl}/listing/${l.slug}`,
      lastModified: new Date(),
    }));

  return [{ url: baseUrl, lastModified: new Date() }, ...urls];
}
