"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type ImageCandidate = {
  slot: number;
  url: string;
};

type Props = {
  listingId: string;
  maxImages?: number; // default 5 TOTAL
  heightClassName?: string;
};

export default function ListingImageCarousel({
  listingId,
  maxImages = 5,
  heightClassName = "h-[260px] md:h-[280px]",
}: Props) {
  // Generate jpg + png candidates per slot
  const initialCandidates = useMemo<ImageCandidate[]>(() => {
    const list: ImageCandidate[] = [];
    for (let i = 1; i <= maxImages; i++) {
      list.push({ slot: i, url: `/listing-images/${listingId}/${i}.jpg` });
      list.push({ slot: i, url: `/listing-images/${listingId}/${i}.png` });
    }
    return list;
  }, [listingId, maxImages]);

  const [candidates, setCandidates] = useState<ImageCandidate[]>(initialCandidates);
  const [images, setImages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  function handleLoad(url: string, slot: number) {
    setCandidates((prev) => prev.filter((c) => c.slot !== slot));

    setImages((prev) => {
      if (prev.includes(url)) return prev;
      return [...prev, url].slice(0, maxImages);
    });
  }

  function handleError(badUrl: string) {
    setCandidates((prev) => prev.filter((c) => c.url !== badUrl));
  }

  const hasImages = images.length > 0;
  const activeUrl = hasImages ? images[index] : "";

  function prev() {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }

  function next() {
    setIndex((i) => (i + 1) % images.length);
  }

  // Nothing to show
  if (!hasImages && candidates.length === 0) return null;

  return (
    <div className="w-full">
      {/* Hidden preloaders to resolve jpg/png per slot */}
      {candidates.map((c) => (
        <Image
          key={c.url}
          src={c.url}
          alt=""
          width={1}
          height={1}
          onLoad={() => handleLoad(c.url, c.slot)}
          onError={() => handleError(c.url)}
          style={{ display: "none" }}
        />
      ))}

      {hasImages && (
        <>
          <div className={`relative w-full overflow-hidden rounded-2xl border bg-white ${heightClassName}`}>
            <Image
              src={activeUrl}
              alt="Listing photo"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 420px"
              priority
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg shadow"
                >
                  ‹
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg shadow"
                >
                  ›
                </button>
              </>
            )}

            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 rounded-full bg-black/35 px-3 py-2">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`h-2 w-2 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            {index + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  );
}
