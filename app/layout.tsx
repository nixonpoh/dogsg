import "./globals.css";
import type { Metadata } from "next";
import ScrollToTopButton from "../components/ScrollToTopButton";

export const metadata: Metadata = {
  title: "DogFriendlyPlaces.sg - Dog cafes, parks, groomers, vets near me and more!",
  description: "Find a dog park near you and other dog-friendly places in Singapore easily.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#FFFBEF] text-black">
        {/* IMPORTANT: this is the scroll container */}
        <div
          id="app-scroll-container"
          className="h-screen flex flex-col overflow-y-auto"
        >
          {/* HEADER (scrolls away normally) */}
          <header className="bg-white border-b shrink-0">
            <div className="mx-auto max-w-6xl px-4 py-2">
              <a href="/" className="flex items-center gap-4 w-fit">
                <img
                  src="/dogsglogo.png"
                  alt="dogfriendlyplaces.sg"
                  className="h-16 w-auto"
                />
                <div>
                  <div className="text-xl font-extrabold tracking-tight">
                    dogfriendlyplaces.sg
                  </div>
                  <div className="text-sm opacity-70">
                    Find dog-friendly places in Singapore <br />
                    More than 100 reviews and above 4 ★ only
                  </div>
                </div>
              </a>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main className="flex-1 min-h-0">
            {children}
          </main>

          {/* FLOATING SCROLL-TO-TOP BUTTON */}
          <ScrollToTopButton />
        </div>
      </body>
    </html>
  );
}
