"use client";

import { useEffect, useState } from "react";

export default function ScrollToTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById("app-scroll-container");
    if (!el) return;

    const onScroll = () => {
      setShow(el.scrollTop > 300); // show after scrolling down
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const el = document.getElementById("app-scroll-container");
    if (!el) return;

    el.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      className={[
        "fixed bottom-4 right-4 z-50",
        "h-12 w-12 rounded-full",
        "bg-pink-500 hover:bg-pink-600",
        "shadow-lg",
        "flex items-center justify-center",
        "transition-all active:scale-95",
        // mobile-first; slightly smaller on desktop
        "md:bottom-6 md:right-6 md:h-11 md:w-11",
        show ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
    >
      {/* White arrow */}
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
