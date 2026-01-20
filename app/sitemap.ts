import type { MetadataRoute } from "next";
import listings from "../data/listings.json";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://dogfriendlyplaces.sg"; // change to your real domain / vercel domain

  const listingUrls = (listings as any[]).map((l) => ({
    url: `${baseUrl}/listing/${l.id}`,
    lastModified: new Date(),
  }));

  return [{ url: baseUrl, lastModified: new Date() }, ...listingUrls];
}
