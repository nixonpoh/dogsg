import "./globals.css";
import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "DogFriendlyPlaces.sg - Dog cafes, parks, groomers, vets near me and more!",
  description: "Find a dog park near you and other dog-friendly places in Singapore easily."
};



export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-[#FFFBEF] text-black">
        <div className="h-screen flex flex-col overflow-hidden">
          {/* GLOBAL HEADER */}
          <header className="bg-white border-b shrink-0">
            <div className="mx-auto max-w-6xl px-4 py-2">
              <a href="/" className="flex items-center gap-4 w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
                    Find dog-friendly places in Singapore
                  </div>
                </div>
              </a>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
  {children}
</main>

        </div>
      </body>
    </html>
  );
}
