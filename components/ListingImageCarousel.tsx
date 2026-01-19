"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  listingId: string;
  maxImages?: number; // max TOTAL (default 5)
  heightClassName?: string;
};

function urlExists(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export default function ListingImageCarousel({
  listingId,
  maxImages = 5,
  heightClassName = "h-[260px] md:h-[280px]",
}: Props) {
  const [urls, setUrls] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function buildUrls() {
      const found: string[] = [];

      for (let i = 1; i <= maxImages; i++) {
        const jpg = `/listing-images/${listingId}/${i}.jpg`;
        const png = `/listing-images/${listingId}/${i}.png`;

        // prefer jpg, fallback to png
        if (await urlExists(jpg)) {
          found.push(jpg);
        } else if (await urlExists(png)) {
          found.push(png);
        }

        if (found.length >= maxImages) break; // total cap
      }

      if (!cancelled) {
        setUrls(found);
        setIndex(0);
        setChecked(true);
      }
    }

    setChecked(false);
    setUrls([]);
    setIndex(0);
    buildUrls();

    return () => {
      cancelled = true;
    };
  }, [listingId, maxImages]);

  const hasImages = urls.length > 0;
  const activeUrl = hasImages ? urls[index] : "";

  function prev() {
    setIndex((i) => (i - 1 + urls.length) % urls.length);
  }
  function next() {
    setIndex((i) => (i + 1) % urls.length);
  }

  // ✅ Requirement: if no images uploaded, don't show carousel at all
  if (checked && !hasImages) return null;

  // (Optional) while checking, you can show nothing (keeps layout clean)
  if (!checked) return null;

  return (
    <div className="w-full">
      <div className={`relative w-full overflow-hidden rounded-2xl border bg-white ${heightClassName}`}>
        <Image
          src={activeUrl}
          alt="Listing photo"
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 420px"
          priority
        />

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

      <div className="mt-2 text-xs text-gray-500">
        {index + 1} / {urls.length}
      </div>
    </div>
  );
}
