"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Props = {
  listingId: string;
  maxImages?: number; // default 5
  heightClassName?: string; // control height from page if you want
};

export default function ListingImageCarousel({
  listingId,
  maxImages = 5,
  heightClassName = "h-[260px] md:h-[280px]",
}: Props) {
  // Pre-generate up to 5 image URLs (we’ll hide any that 404 via onError)
  const initialUrls = useMemo(() => {
    const urls: string[] = [];
    for (let i = 1; i <= maxImages; i++) {
      urls.push(`/listing-images/${listingId}/${i}.jpg`);
    }
    return urls;
  }, [listingId, maxImages]);

  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [index, setIndex] = useState(0);

  // If an image fails to load, remove it
  function handleError(badUrl: string) {
    setUrls((prev) => {
      const next = prev.filter((u) => u !== badUrl);
      if (index >= next.length) setIndex(Math.max(0, next.length - 1));
      return next;
    });
  }

  const hasImages = urls.length > 0;
  const activeUrl = hasImages ? urls[index] : "";

  function prev() {
    setIndex((i) => (i - 1 + urls.length) % urls.length);
  }
  function next() {
    setIndex((i) => (i + 1) % urls.length);
  }

  // ✅ CHANGE: If there are no images, don't render anything at all
  if (!hasImages) return null;

  return (
    <div className="w-full">
      <div className={`relative w-full overflow-hidden rounded-2xl border bg-white ${heightClassName}`}>
        <Image
          src={activeUrl}
          alt="Listing photo"
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 420px"
          onError={() => handleError(activeUrl)}
          priority
        />

        {/* Left/Right controls (only if 2+ images) */}
        {urls.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg shadow hover:bg-white"
              aria-label="Previous image"
              type="button"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg shadow hover:bg-white"
              aria-label="Next image"
              type="button"
            >
              ›
            </button>
          </>
        )}

        {/* Dots */}
        {urls.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 rounded-full bg-black/35 px-3 py-2">
            {urls.map((u, i) => (
              <button
                key={u}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-2 w-2 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Optional tiny caption */}
      <div className="mt-2 text-xs text-gray-500">
        {urls.length > 0 ? `${index + 1} / ${urls.length}` : ""}
      </div>
    </div>
  );
}
